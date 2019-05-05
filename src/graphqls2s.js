/**
 * Copyright (c) 2018, Neap Pty Ltd.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/

// Inheritance:
// ============
// 	_getObjWithExtensions: This function is the one that compiles types that inherits from others. 
// 	
// Generic Types:
// ==============
// 	_createNewSchemaObjectFromGeneric: This function is the one that created new types from Generic Types.

const _ = require('lodash')
const { chain, log, escapeGraphQlSchema, getQueryAST, buildQuery, newShortId, isScalarType } = require('./utilities')
const { extractGraphMetadata, removeGraphMetadata } = require('./graphmetadata')

const GENERICTYPEREGEX = /<(.*?)>/
const TYPENAMEREGEX = /type\s(.*?){/
const INPUTNAMEREGEX = /input\s(.*?){/
const ENUMNAMEREGEX = /enum\s(.*?){/
const INTERFACENAMEREGEX = /interface\s(.*?){/
const ABSTRACTNAMEREGEX = /abstract\s(.*?){/
const INHERITSREGEX = /inherits\s+[\w<>]+(?:\s*,\s*\w+)*/g
const IMPLEMENTSREGEX = /implements\s(.*?)\{/mg
const PROPERTYPARAMSREGEX = /\((.*?)\)/

const TYPE_REGEX = { regex: /(extend type|type)\s(.*?){(.*?)░([^#]*?)}/mg, type: 'type' }
const INPUT_REGEX = { regex: /(extend input|input)\s(.*?){(.*?)░([^#]*?)}/mg, type: 'input' }
const ENUM_REGEX = { regex: /enum\s(.*?){(.*?)░([^#]*?)}/mg, type: 'enum' }
const INTERFACE_REGEX = { regex: /(extend interface|interface)\s(.*?){(.*?)░([^#]*?)}/mg, type: 'interface' }
const ABSTRACT_REGEX = { regex: /(extend abstract|abstract)\s(.*?){(.*?)░([^#]*?)}/mg, type: 'abstract' }
const SCALAR_REGEX = { regex: /(.{1}|.{0})scalar\s(.*?)([^\s]*?)(?![a-zA-Z0-9])/mg, type: 'scalar' }
const UNION_REGEX = { regex: /(.{1}|.{0})union([^\n]*?)\n/gm, type: 'union' }

const carrReturnEsc = '░'
const tabEsc = '_t_'

let _s = {}
const escapeGraphQlSchemaPlus = (sch, cr, t) => {
	if (!sch)
		return sch

	if (!_s[sch])
		_s[sch] = escapeGraphQlSchema(sch, cr, t)

	return _s[sch]
}

/**
 * Gets a first rough breakdown of the string schema
 * @param  {String} sch Original GraphQl Schema
 * @return {Array}      Using regex, the interfaces, types, inputs, enums and abstracts entities are isolated
 *                      e.g. [{
 *                      		property: 'type Query { bars: [Bar]! }',
 *                      		block: [ 'bars: [Bar]!' ],
 *                      		extend: false
 *                      	},{
 *                      		property: 'type Bar { id: ID }',
 *                      		block: [ 'id: ID' ],
 *                      		extend: false
 *                      	}]
 */
const _getSchemaBits = (sch='') => {
	const escapedSchemaWithComments = escapeGraphQlSchemaPlus(sch, carrReturnEsc, tabEsc)

	const comments = [
		...(escapedSchemaWithComments.match(/#(.*?)░/g) || []),
		...(escapedSchemaWithComments.match(/"""░(.*?)░\s*"""░/g) || []),
		...(escapedSchemaWithComments.match(/"([^"]+)"░/g) || []),
	]
	const { schema:escSchemaWithEscComments, tokens } = comments.reduce((acc,m) => {
		const commentToken = `#${newShortId()}░`
		acc.schema = acc.schema.replace(m, commentToken)
		acc.tokens.push({ id: commentToken, value: m })
		return acc
	}, { schema: escapedSchemaWithComments, tokens: [] })
	
	// We append '\n' to help isolating the 'union'
	const schemaWithoutComments = ' ' + sch.replace(/#(.*?)\n/g, '').replace(/"""\s*\n([^]*?)\n\s*"""\s*\n/g, '').replace(/"([^"]+)"\n/g, '') + '\n'
	const escapedSchemaWithoutComments = escapeGraphQlSchemaPlus(schemaWithoutComments, carrReturnEsc, tabEsc)
	return _.flatten([TYPE_REGEX, INPUT_REGEX, ENUM_REGEX, INTERFACE_REGEX, ABSTRACT_REGEX, SCALAR_REGEX, UNION_REGEX]
	.map(rx =>
		// 1. Apply the regex matching
		chain((
			rx.type == 'scalar' ? escapedSchemaWithoutComments :
			rx.type == 'union' ? schemaWithoutComments :
			escSchemaWithEscComments).match(rx.regex) || [])
		// 2. Filter the right matches
		.next(regexMatches =>
			rx.type == 'scalar' ? regexMatches.filter(m => m.indexOf('scalar') == 0 || m.match(/^(?![a-zA-Z0-9])/)) :
			rx.type == 'union' ? regexMatches.filter(m => m.indexOf('union') == 0 || m.match(/^(?![a-zA-Z0-9])/)) : regexMatches)
		// 3. Replace the excaped comments with their true value
		.next(regexMatches => regexMatches.map(b => (b.match(/#(.*?)░/g) || []).reduce((acc,m) => {
			const value = (tokens.find(t => t.id == m) || {}).value
			return value ? acc.replace(m, value) : acc
		}, b)))
		// 4. Breackdown each match into 'property', 'block' and 'extend'
		.next(regexMatches => {
			const transform =
				rx.type == 'scalar' ? _breakdownScalarBit :
				rx.type == 'union' ? _breakdownUnionBit : _breakdownSchemabBit
			return regexMatches.map(str => transform(str))
		})
		.val()))
}

const _breakdownSchemabBit = str => {
	const blockMatch = str.match(/{(.*?)░([^#]*?)}/)
	if (!blockMatch) {
		const msg = 'Schema error: Missing block'
		log(msg)
		throw new Error(msg)
	}

	const block = _.toArray(_(blockMatch[0].replace(/_t_/g, '').replace(/^{/,'').replace(/}$/,'').split(carrReturnEsc).map(x => x.trim())).filter(x => x != ''))
	const rawProperty = str.split(carrReturnEsc).join(' ').split(tabEsc).join(' ').replace(/ +(?= )/g,'').trim()
	const { property, extend } = rawProperty.indexOf('extend') == 0
		? { property: rawProperty.replace('extend ', ''), extend: true }
		: { property: rawProperty, extend: false }
	return { property, block, extend }
}

const _breakdownScalarBit = str => {
	const block = (str.split(' ').slice(-1) || [])[0]
	return { property: `scalar ${block}`, block: block, extend: false }
}

const _breakdownUnionBit = str => {
	const block = str.replace(/(^union\s|\sunion\s|\n)/g, '').trim()
	return { property: `union ${block}`, block: block, extend: false }
}

/**
 * 
 * @param  {String} firstLine		First line of a code block (e.g., 'type Page {')
 * @return {String} output.type		Valid values: 'TYPE', 'ENUM', 'INPUT', 'INTERFACE', 'UNION', 'SCALAR'
 * @return {String} output.name		e.g., 'Page'
 */
const _getSchemaEntity = firstLine =>
	firstLine.indexOf('type') == 0 ? { type: 'TYPE', name: firstLine.match(/type\s+(.*?)\s+.*/)[1].trim() } :
	firstLine.indexOf('enum') == 0 ? { type: 'ENUM', name: firstLine.match(/enum\s+(.*?)\s+.*/)[1].trim() } :
	firstLine.indexOf('input') == 0 ? { type: 'INPUT', name: firstLine.match(/input\s+(.*?)\s+.*/)[1].trim() } :
	firstLine.indexOf('interface') == 0 ? { type: 'INTERFACE', name: firstLine.match(/interface\s+(.*?)\s+.*/)[1].trim() } :
	firstLine.indexOf('union') == 0 ? { type: 'UNION', name: firstLine.match(/union\s+(.*?)\s+.*/)[1].trim() } :
	firstLine.indexOf('scalar') == 0 ? { type: 'SCALAR', name: firstLine.match(/scalar\s+(.*?)\s+.*/)[1].trim() } :
	{ type: null, name: null }

/**
 * Gets all the comments associated to the schema blocks. 
 * 
 * @param  {String} sch							Raw GraphQL schema. 
 * @return {String} output[].text				Comment
 * @return {String} output[].property.type		Valid values: 'TYPE', 'ENUM', 'INPUT', 'INTERFACE', 'UNION', 'SCALAR'
 * @return {String} output[].property.name		Property name (e.g., 'User' if the block started with 'type User {').
 */
const _getCommentsBits = (sch) => 
	(escapeGraphQlSchemaPlus(sch, carrReturnEsc, tabEsc).match(/░\s*[#"](.*?)░([^#"]*?)({|}|:)/g) || [])
	.filter(x => x.match(/{$/))
	.map(c => {
		const parts = _(c.split(carrReturnEsc).map(l => l.replace(/_t_/g, '    ').trim())).filter(x => x != '')
		const hashCount = parts.reduce((a,b) => {
			a.count = a.count + (b.indexOf('#') == 0 || b.indexOf('"') == 0 || a.inComment ? 1 : 0)
			if (b.indexOf('"""') === 0) {
				a.inComment = !a.inComment
			}
			return a
		}, { count: 0, inComment: false }).count
		return { text: parts.initial(), property: _getSchemaEntity(parts.last()), comments: hashCount == parts.size() - 1 }
	})
	.filter(x => x.comments).map(x => ({ text: x.text.join('\n'), property: x.property }))

/**
 * Gets the alias for a generic type (e.g. Paged<Product> -> PagedProduct)
 * @param  {String} genName e.g. Paged<Product>
 * @return {String}         e.g. PagedProduct
 */
const _genericDefaultNameAlias = genName => {
	if (!genName)
		return ''
	const m = genName.match(GENERICTYPEREGEX)
	if (m) {
		const parts = genName.split(m[0])
		return `${parts[0]}${m[1].split(',').map(x => x.trim()).join('')}`
	} else
		return genName
}

/**
 * Example: [T] -> [User], or T -> User or Toy<T> -> Toy<User>
 * @param  {string} genericType   	e.g. 'Toy<T>', 'Toy<T,U>'
 * @param  {array}  genericLetters 	e.g. ['T'], ['T','U']
 * @param  {string} concreteType  	e.g. 'User', 'User,Product'
 * @return {string}               	e.g. 'Toy<User>', 'Toy<User,Product>'
 */
const _replaceGenericWithType = (genericType, genericLetters, concreteType) =>
	chain({ gType: genericType.replace(/\s/g, ''), gLetters: genericLetters.map(x => x.replace(/\s/g, '')), cTypes: concreteType.split(',').map(x => x.replace(/\s/g, '')) })
	.next(({ gType, gLetters, cTypes }) => {
		const cTypesLength = cTypes.length
		const genericTypeIsArray = gType.indexOf('[') == 0 && gType.indexOf(']') > 0
		const endingChar = gType.match(/!$/) ? '!' : ''
		if (gLetters.length != cTypesLength)
			throw new Error(`Invalid argument exception. Mismatch between the number of types in 'genericLetters' (${genericLetters.join(',')}) and 'concreteType' (${concreteType}).`)
		// e.g. genericType = 'T', genericLetters = ['T'], concreteType = 'User' -> resp = 'User'
		if (gLetters.length == 1 && gType.replace(/!$/, '') == gLetters[0])
			return  `${cTypes[0]}${endingChar}`
		// e.g. genericType = 'Paged<T>' or '[Paged<T>]'
		else if (gType.indexOf('<') > 0 && gType.indexOf('>') > 0) {
			const type = genericTypeIsArray ? gType.match(/\[(.*?)\]/)[1] : gType
			const typeName = type.match(/.*</)[0].replace(/<$/,'').trim() // e.g. 'Toy'
			const types = type.match(/<(.*?)>/)[1].split(',').map(x => x.trim())
			if (types.length != gLetters.length)
				throw new Error(`Invalid argument exception. Mismatch between the number of types in 'genericLetters' (${genericLetters.join(',')}) and 'genericType' (${genericType}).`)

			const matchingConcreteTypes = types.map(t => {
				for(let i=0;i<cTypesLength;i++) {
					if (gLetters[i] == t)
						return cTypes[i]
				}
				throw new Error(`Invalid argument exception. Mismatch types between the 'genericType' (${genericType}) and the allowed types 'genericLetters' (${genericLetters.join(',')}).`)
			})
			const result = `${typeName}<${matchingConcreteTypes.join(',')}>`

			return genericTypeIsArray ? `[${result}]${endingChar}` : `${result}${endingChar}`
		} else { // e.g. genericType = 'T' or '[T]'
			const type = genericTypeIsArray ? gType.match(/\[(.*?)\]/)[1] : gType
			const matchingConcreteTypes = type.split(',').map(t => {
				const isRequired = /!$/.test(t)
				t = (isRequired ? t.replace(/!$/, '') : t).trim()
				for(let i=0;i<cTypesLength;i++) {
					if (gLetters[i] == t)
						return `${cTypes[i]}${isRequired ? '!' : ''}`
				}
				throw new Error(`Invalid argument exception. Mismatch types between the 'genericType' (${genericType}) and the allowed types 'genericLetters' (${genericLetters.join(',')}).`)
			})
			const result = matchingConcreteTypes.join(',')
			return genericTypeIsArray ? `[${result}]${endingChar}` : `${result}${endingChar}`
		}
	})
	.val()

let memoizedGenericNameAliases = {}
const _getAliasName = (genericType, metadata) => {
	if (memoizedGenericNameAliases[genericType])
		return memoizedGenericNameAliases[genericType]

	const genericStart = genericType.match(/.*</)[0]
	const aliasObj = Array.isArray(metadata) 
		? _getAllAliases(metadata).find(x => x.schemaName.indexOf(genericStart) == 0)
		: metadata && metadata.name == 'alias' ? metadata : null
	const alias = aliasObj && aliasObj.body ? getGenericAlias(aliasObj.body)(genericType) : _genericDefaultNameAlias(genericType)
	memoizedGenericNameAliases[genericType] = alias

	return alias
}

let memoizedAliases = null
const _getAllAliases = metadata => memoizedAliases || chain((metadata || []).filter(x => x.name == 'alias')).next(aliases => {
	memoizedAliases = aliases
	return aliases
}).val()

let memoizedGenericSchemaObjects = {}
/**
 * Get all the type details
 *
 * @param  {String}  t            				Type (e.g. Paged<Product> or Paged<T,U>)
 * @param  {Array}   metadata     				Array of metadata objects
 * @param  {Array}   genericParentTypes 		Array of string representing the types (e.g. ['T', 'U']) of the generic parent type
 *                                  	     	of that type if that type was extracted from a block. If this array is null, that
 *                                  	      	means the parent type was not a generic type.
 * @return {String}  result.originName			't'
 * @return {Boolean} result.isGen				Indicates if 't' is a generic type
 * @return {Boolean} result.dependsOnParent		Not null if 't' is a generic. Indicates if the generic type of 't' depends
 *                                           	on its parent's type (if true, then that means the parent is itself a generic)
 * @return {Array} 	 result.metadata			'metadata'
 * @return {Array} 	 result.genericParentTypes	If the parent is a generic type, then ths array contains contain all the
 *                                             	underlying types.
 * @return {String}  result.name				If 't' is not a generic type then 't' otherwise determine what's new name.
 */
const _getTypeDetails = (t, metadata, genericParentTypes) => chain((t.match(GENERICTYPEREGEX) || [])[1])
	.next(genTypes => {
		const isGen = genTypes ? true : false
		const genericTypes = isGen ? genTypes.split(',').map(x => x.trim()) : null
		const originName = t.replace(/@.+/, '').trim()
		const directive = (t.match(/@.+/) || [])[0]
		const endingChar = originName.match(/!$/) ? '!' : ''
		const dependsOnParent = isGen && genericParentTypes && genericParentTypes.length > 0 && genericTypes.some(x => genericParentTypes.some(y => x == y))
		return {
			originName,
			directive,
			isGen,
			dependsOnParent,
			metadata,
			genericParentTypes,
			name: isGen && !dependsOnParent ? `${_getAliasName(originName, metadata)}${endingChar}` : originName
		}
	})
	.next(result => {
		if (result.isGen && !memoizedGenericSchemaObjects[result.name])
			memoizedGenericSchemaObjects[result.name] = result
		return result
	})
	.val()

/**
 * Transpile parameters if generic types are used in them
 *
 * @param  {String}  params            			Parameters (e.g. (filter: Filtered<Product>)
 * @param  {Array}   metadata     				Array of metadata objects
 * @param  {Array}   genericParentTypes 		Array of string representing the types (e.g. ['T', 'U']) of the generic parent type
 *                                  	     	of that type if that type was extracted from a block. If this array is null, that
 *                                  	      	means the parent type was not a generic type.
 * @return {String}  transpiledParams			The transpiled parameters
 */
const _getTranspiledParams = (params, genericParentTypes) => chain(params.split(','))
	.next(genTypes => {
		const transpiledParams = []
		genTypes.forEach(genType => {
			const genericTypeMatches = genType.match(GENERICTYPEREGEX)
            const isGen = !!genericTypeMatches
            const genericTypes = isGen ? genTypes.map(x => x.trim()) : null
			if(!genType) return
			const [ paramName, originName ] = genType.split(':').map(item => item.trim())
            const endingChar = originName.match(/!$/) ? '!' : ''
            const dependsOnParent = isGen && genericParentTypes && genericParentTypes.length > 0 && genericTypes.some(x => genericParentTypes.some(y => x === y))
            const result = {
                paramName,
                originName,
                isGen,
                name: isGen && !dependsOnParent ? `${_getAliasName(originName)}${endingChar}` : originName
            }
            if (result.isGen && !memoizedGenericSchemaObjects[result.name])
                memoizedGenericSchemaObjects[result.name] = result
            transpiledParams.push(`${result.paramName}: ${result.name}`)
		})
		return transpiledParams
	})
	.next(result => {
		return result.join(', ')
	})
	.val()

const _getPropertyValue = ({ name, params, result }, mapResultName) => {
	const leftPart = `${name}${params ? `(${params})` : ''}`
	let delimiter = ''
	let rightPart = ''
	if (result && result.name) {
		delimiter = ': '
		rightPart = mapResultName ? mapResultName(result.name) : result.name
		if (result.directive)
			rightPart = `${rightPart} ${result.directive}`
	}
	return `${leftPart}${delimiter}${rightPart}`
}

/**
 * Breaks down a string representing a block { ... } into its various parts.
 * @param  {string} blockParts 				String representing your entire block (e.g. { users: User[], posts: Paged<Post> })
 * @param  {object} baseObj
 * @param  {string} baseObj.type 			Type of the object with blockParts (e.g. TYPE, ENUM, ...)
 * @param  {string} baseObj.name 			Name of the object with blockParts
 * @param  {array} 	baseObj.genericTypes 	Array of types if the 'baseObj' is a generic type.
 * @param  {array}  metadata 				Array of object. Each object represents a metadata. Example: { name: 'node', body: '(name:hello)', schemaType: 'PROPERTY', schemaName: 'rating: PostRating!', parent: { type: 'TYPE', name: 'PostUserRating', metadata: [Object] } }
 * @return [{
 *         		comments: string,
 *         		details: {
 *         					name: string,
 *         					metadata: {
 *         						name: string,
 *         						body: string,
 *         						schemaType: string,
 *         						schemaName: string,
 *         						parent: {
 *         							type: string,
 *         							name: string,
 *         							metadata: [Object]
 *         						}
 *         					},
 *         					params: string,
 *         					result: {
 *         						originName: string,
 *         						isGen: boolean,
 *         						name: string
 *         					}
 *         				},
 *         		value: string
 *         }]             									Property breakdown
 */
const _getBlockProperties = (blockParts, baseObj, metadata) =>
	chain(_(metadata).filter(m => m.schemaType == 'PROPERTY' && m.parent && m.parent.type == baseObj.type && m.parent.name == baseObj.name))
	.next(meta => _(blockParts).reduce((a, part) => {
		const p = part.trim()
		const mData = meta.filter(m => m.schemaName == p).first() || null
		if (p.indexOf('#') == 0 || p.indexOf('"') == 0 || a.insideComment) {
			if (p.indexOf('"""') === 0) {
				a.insideComment = !a.insideComment
			}
			a.comments.push(p)
		} else {
			const prop = p.replace(/ +(?= )/g,'').replace(/,$/, '')
			const paramsMatch  = prop.replace(/@.+/, '').match(PROPERTYPARAMSREGEX)
			const propDetails = paramsMatch
				? chain(prop.split(paramsMatch[0]))
					.next(parts => ({ name: parts[0].trim(), metadata: mData, params: _getTranspiledParams(paramsMatch[1], baseObj.genericTypes), result: _getTypeDetails((parts[1] || '').replace(':', '').trim(), metadata, baseObj.genericTypes) })).val()
				: chain(prop.split(':'))
					.next(parts => ({ name: parts[0].trim(), metadata: mData, params: null, result: _getTypeDetails(parts.slice(1).join(':').trim(), metadata, baseObj.genericTypes) })).val()
			a.props.push({
				comments: a.comments.join('\n    '),
				details: propDetails,
				value: _getPropertyValue(propDetails)
			})
			a.comments = []
		}
		return a
	}, { insideComment: false, comments:[], props:[] }).props)
	.val()

/**
 * [description]
 * @param  {Array} 	definitions Array of objects ({ property:..., block: [...], extend: ... }) coming from the '_getSchemaBits' function
 * @param  {String} typeName    e.g. 'type' or 'input'
 * @param  {RegExp} nameRegEx   Regex that can extract the specific details of the schema bit (i.e. definitions)
 * @param  {Array} 	metadata    metadata coming from the 'extractGraphMetadata' method.
 * @return {Array}             	Array of objects: Example:
 *                              [{
 *                              	type: 'TYPE',
 *                              	extend: false,
 *                              	name: 'Foo',
 *                              	metadata: null,
 *                              	genericType: null,
 *                              	blockProps: [ { comments: '', details: [Object], value: 'id: String!' } ],
 *                              	inherits: null,
 *                              	implements: null },
 *                              {
 *                              	type: 'TYPE',
 *                              	extend: true,
 *                              	name: 'Query',
 *                              	metadata: null,
 *                              	genericType: null,
 *                              	blockProps: [ { comments: '', details: [Object], value: 'foos: [Foo]!' } ],
 *                              	inherits: null,
 *                              	implements: null
 *                              }]
 */
const _getSchemaObject = (definitions, typeName, nameRegEx, metadata) =>
	_.toArray(_(definitions).filter(d => d.property.indexOf(typeName) == 0)
	.map(d => {
		if (typeName == 'scalar')
			return {
				type: 'SCALAR',
				extend: false,
				name: d.block,
				metadata: null,
				genericType: false,
				blockProps: [],
				inherits: null,
				implements: null
			}
		else if (typeName == 'union')
			return {
				type: 'UNION',
				extend: false,
				name: d.block,
				metadata: null,
				genericType: false,
				blockProps: [],
				inherits: null,
				implements: null
			}
		else {
			const typeDefMatch = d.property.match(/(.*?){/)
			if (!typeDefMatch || typeDefMatch[0].indexOf('#') >= 0) throw new Error(`Schema error: Syntax error in '${d.property}'. Cannot any find schema type definition.`)
			const typeDef = typeDefMatch[0]
			const nameMatch = typeDef.match(nameRegEx)
			if (!nameMatch) throw new Error(`Schema error: ${typeName} with missing name.`)
			const name = nameMatch[1].trim().split(' ')[0]
			const genericTypeMatch = name.match(GENERICTYPEREGEX)
			const isGenericType = genericTypeMatch ? genericTypeMatch[1] : null
			const inheritsMatch = typeDef.match(INHERITSREGEX)
			const superClass = inheritsMatch && inheritsMatch[0].replace('inherits', '').trim().split(',').map(v => v.trim()) || null
			const implementsMatch = typeDef.match(IMPLEMENTSREGEX)
			const directive = (typeDef.match(/@[a-zA-Z0-9_]+(.*?)$/) || [''])[0].trim().replace(/{$/, '').trim() || null

			const _interface = implementsMatch
				? implementsMatch[0].replace('implements ', '').replace('{', '').split(',').map(x => x.trim().split(' ')[0])
				: null

			const objectType = typeName.toUpperCase()
			const metadat = metadata
				? _(metadata).filter(m => m.schemaType == objectType && m.schemaName == name).first() || null
				: null

			const genericTypes = isGenericType ? isGenericType.split(',').map(x => x.trim()) : null
			const baseObj = { type: objectType, name: name, genericTypes: genericTypes }

			const result = {
				type: objectType,
				extend: d.extend,
				name: name,
				metadata: metadat,
				directive: directive,
				genericType: isGenericType,
				blockProps: _getBlockProperties(d.block, baseObj, metadata),
				inherits: superClass,
				implements: _interface
			}
			return result
		}
	}))

const getGenericAlias = s => !s ? _genericDefaultNameAlias :
genName => chain(genName.match(GENERICTYPEREGEX)).next(m => m
	? chain(m[1].split(',').map(x => `"${x.trim()}"`).join(',')).next(genericTypeName => eval(s + '(' + genericTypeName + ')')).val()
	: genName).val()

const _getInterfaces = (definitions, metadata) => _getSchemaObject(definitions, 'interface', INTERFACENAMEREGEX, metadata)

const _getAbstracts = (definitions, metadata) => _getSchemaObject(definitions, 'abstract', ABSTRACTNAMEREGEX, metadata)

const _getTypes = (definitions, metadata) => _getSchemaObject(definitions, 'type', TYPENAMEREGEX, metadata)

const _getInputs = (definitions, metadata) => _getSchemaObject(definitions, 'input', INPUTNAMEREGEX, metadata)

const _getEnums = (definitions, metadata) => _getSchemaObject(definitions, 'enum', ENUMNAMEREGEX, metadata)

const _getScalars = (definitions, metadata) => _getSchemaObject(definitions, 'scalar', null, metadata)

const _getUnions = (definitions, metadata) => _getSchemaObject(definitions, 'union', null, metadata)

/**
 * [description]
 * @param  {String} genericTypeName e.g., 'Page<User,Product>'
 * @return {String}                 e.g., 'Page<0,1>'
 */
const _getCanonicalGenericType = genericTypeName => {
	const [,types] = (genericTypeName || '').match(/<(.*?)>/) || []
	if (!types)
		return ''
	const canon = types.split(',').map((_,idx) => idx).join(',')
	return genericTypeName.replace(/<(.*?)>/, `<${canon}>`)
}

/**
 * Determines if a generic type is defined in the Schema. 
 * 
 * @param  {String} 	  schemaTypeName 	e.g., Page<User>
 * @param  {[SchemaType]} rawSchemaTypes 	All the available Schema Types. For example, if there is a { name: 'Page<T>' }, then 
 *                                        	this function returns true
 * @return {Boolean}	  output 			                			
 */
const _isGenericTypeDefined = (schemaTypeName, rawSchemaTypes) => {
	if (!schemaTypeName || !rawSchemaTypes || rawSchemaTypes.length === 0)
		return false 

	const canonicalSchemaTypeName = _getCanonicalGenericType(schemaTypeName)
	if (!canonicalSchemaTypeName)
		return false

	const canonicalGenericTypeNames = rawSchemaTypes.filter(({ genericType }) => genericType).map(({ name }) => _getCanonicalGenericType(name))
	return canonicalGenericTypeNames.some(name => name === canonicalSchemaTypeName)
}

const _getDefaultGenericName = concreteGenericTypeName => (concreteGenericTypeName || '').replace(/[<>,\s]/g,'')

let _memoizedConcreteGenericTypes = {}
/**
 * [description]
 * @param  {String}   	  concreteGenericTypeName	Generic type name (e.g., 'Paged<User>')
 * @param  {[SchemaType]} rawSchemaTypes			Array of not fully compiled Schema type objects.
 * @param  {[Comments]}   comments					comments[].text, comments[].property.type, comments[].property.name 
 * @param  {String}   	  aliasName					Overides the default name. For example. If 'concreteGenericTypeName' is 'Paged<User>'
 *													its default name is 'PageUser'.
 * @return {SchemaType} 							Resolved Schema Type object.
 */
const _resolveGenericType = ({ concreteGenericTypeName, rawSchemaTypes, comments, aliasName }) => {
	// 1. Returns if the result was already memoized before.
	const defaultConcreteName = aliasName || _getDefaultGenericName(concreteGenericTypeName)
	if (_memoizedConcreteGenericTypes[defaultConcreteName])
		return _memoizedConcreteGenericTypes[defaultConcreteName]

	// 2. Find the Generic definition type in the 'rawSchemaTypes'
	const genericTypePrefix = ((concreteGenericTypeName.match(/.+</) || [])[0] || '').replace(/\[/g,'') // e.g., Paged<

	if (!genericTypePrefix) 
		throw new Error(`Schema error: Cannot find type in generic object ${concreteGenericTypeName}`)

	const genericDefType = rawSchemaTypes.find(({ name }) => name.indexOf(genericTypePrefix) == 0)

	if (!genericDefType) 
		throw new Error(`Schema error: Cannot find any definition for generic type starting with ${genericTypePrefix}`)
	else if (!genericDefType.genericType)
		throw new Error(`Schema error: Schema object ${genericDefType.name} is not generic!`)

	// 3. Resolve the types and the inherited types 
	// 3.1. Resolve the types (e.g., if concreteGenericTypeName is 'Paged<User,Product>', typeNames is ['User', 'Product'])
	const typeNames = ((concreteGenericTypeName.match(/<(.*?)>/) || [])[1] || '').split(',').map(x => x.trim()).filter(x => x)
	// 3.1.1. WARNING: This code creates side-effects by mutating '_memoizedConcreteGenericTypes'. 
	// This is the intended goal as '_memoizedConcreteGenericTypes' is used to in '_getSchemaBits' to get the new generic ASTs.
	typeNames.map(typeName => {
		if (isScalarType(typeName))
			return 
		_getType(typeName, rawSchemaTypes, comments)
	})
	
	// 3.2. Resolve the inherited types 
	const superClasses = (genericDefType.inherits || []).map(superClassName => _getType(superClassName, rawSchemaTypes, comments))
	// 3.2.1. WARNING: This code creates side-effects by mutating '_memoizedConcreteGenericTypes'. 
	// This is the intended goal as '_memoizedConcreteGenericTypes' is used to in '_getSchemaBits' to get the new generic ASTs.
	superClasses.map((superClass) => {
		if (!_inheritingIsAllowed(genericDefType, superClass)){
			throw new Error('Schema error: ' + genericDefType.type.toLowerCase() + ' ' + genericDefType.name + ' cannot inherit from ' + superClass.type + ' ' + superClass.name + '.')  
		}            
		return _resolveSchemaType(superClass, rawSchemaTypes, comments)
	})

	// 4. Resolving each property of the generic type definition based on the concrete type.
	const blockProps = genericDefType.blockProps.map(prop => {
		let p = prop
		const concreteType = typeNames.join(',')
		if (isTypeGeneric(prop.details.result.name, genericDefType.genericType)) {
			let details = {
				name: prop.details.name,
				params: prop.params,
				result: {
					originName: prop.details.originName,
					isGen: prop.details.isGen,
					name: _replaceGenericWithType(prop.details.result.name, genericDefType.genericType.split(','), concreteType)
				}
			}

			// 4.1. This is a case where this property is from a generic type similar to type Paged<T> { data:User<T> }. The property
			// 'data' depends on parent.
			if (prop.details.result.dependsOnParent) {
				const propTypeIsRequired = prop.details.result.name.match(/!$/)
				const propTypeName = propTypeIsRequired ? prop.details.result.name.replace(/!$/,'') : prop.details.result.name // e.g. [Paged<T>]
				const propTypeIsArray = propTypeName.match(/^\[.*\]$/)
				const originalConcretePropType = _replaceGenericWithType(propTypeName, prop.details.result.genericParentTypes, concreteType) // e.g. [Paged<Product>]
				const concretePropType = propTypeIsArray ? originalConcretePropType.replace(/^\[|\]$/g,'') : originalConcretePropType // e.g. Paged<Product>
				const concreteGenProp = _getTypeDetails(concretePropType, prop.details.result.metadata)
				const concreteGenPropName = concreteGenProp.name || _getDefaultGenericName(concretePropType) // e.g. PagedProduct
				let originalConcretePropTypeName = propTypeIsArray ? `[${concreteGenPropName}]` : concreteGenPropName // e.g. [PagedProduct]
				originalConcretePropTypeName = originalConcretePropTypeName + (propTypeIsRequired ? '!' : '') // e.g. [PagedProduct]!
				originalConcretePropTypeName = prop.details.result.directive ? `${originalConcretePropTypeName} ${prop.details.result.directive}` : originalConcretePropTypeName // e.g. [PagedProduct]! @isAuthenticated
				details.result = {
					originName: prop.details.result.directive ? `${prop.details.result.name} ${prop.details.result.directive}` : prop.details.result.name,
					isGen: true,
					name: originalConcretePropTypeName
				}

				// 4.1.1. Make sure this new generic type is memoized. WARNING: This code creates side-effects by mutating '_memoizedConcreteGenericTypes'. 
				// This is the intended goal as '_memoizedConcreteGenericTypes' is used to in '_getSchemaBits' to get the new generic ASTs.
				_resolveGenericType({ concreteGenericTypeName:concretePropType, rawSchemaTypes, comments, aliasName:concreteGenPropName })
			}

			p = {
				comments: prop.comments,
				details: details,
				value: _getPropertyValue(details)
			}
		}

		return p
	})

	const result = {
		comments: _getPropertyComments(genericDefType, comments),
		type: genericDefType.type,
		name:defaultConcreteName,
		implements: genericDefType.implements,
		blockProps: blockProps,
		genericType: null
	}
	
	_memoizedConcreteGenericTypes[defaultConcreteName] = result

	return result
}

/**
 * Gets the type from 'rawSchemaTypes'. 
 * 
 * @param  {String} 	  typeName       	e.g., 'User', or 'Paged<User>' 
 * @param  {[SchemaType]} rawSchemaTypes 	Array of not fully compiled Schema type objects.
 * @param  {[Comments]}   comments			comments[].text, comments[].property.type, comments[].property.name 
 * @return {SchemaType}                		Schema type from 'rawSchemaTypes' that matches 'typeName'. If 'typeName' is
 *											a generic type (e.g., 'Paged<User>'), the the returned type is fully compiled.
 */
const _getType = (typeName, rawSchemaTypes, comments) => {
	let type = rawSchemaTypes.find(({ name }) => name == typeName)
	// 3.1. Double-check that the missing super class is not a generic type. 
	if (!type) {
		if (!_isGenericTypeDefined(typeName, rawSchemaTypes))
			throw new Error(`Schema error: Type '${typeName}' cannot be found in the schema.`)

		type = _resolveGenericType({
			concreteGenericTypeName:typeName,
			rawSchemaTypes,
			comments
		})
	}

	return type
}

const _resolveGenericBlockProperies = (blockProperties,rawSchemaTypes,comments) => (blockProperties || []).forEach(prop => {
	if (prop && prop.details && prop.details.result && prop.details.result.isGen && !prop.details.result.dependsOnParent) 
		_resolveGenericType({ concreteGenericTypeName:prop.details.result.originName, rawSchemaTypes, comments, aliasName:prop.details.result.name })
})

let memoizedExtendedObject = {}
/**
 * [description]
 * @param  {SchemaType}   schemaType		Not fully compiled Schema type object. 
 * @param  {[SchemaType]} rawSchemaTypes	Array of not fully compiled Schema type objects.
 * @param  {[Comments]}   comments			comments[].text, comments[].property.type, comments[].property.name 
 * @return {SchemaType}                		Resolved Schema Type object.
 */
const _resolveSchemaType = (schemaType, rawSchemaTypes, comments) => {
	const resolvedType = (() => {
		// 1. Use the trivial resolution method if the schema type does not need advanced resolution (i.e., it does not 
		// 	  inherits from complex types, or is not a generic type).
		if (!schemaType || !rawSchemaTypes || !schemaType.inherits) 
			return _resolveUsingTrivialMethod(schemaType, rawSchemaTypes, comments)

		// 2. Returns immediately if the schema type has already been resolved.
		const key = `${schemaType.type}_${schemaType.name}_${schemaType.genericType}`
		if (memoizedExtendedObject[key]) 
			return memoizedExtendedObject[key]

		// 3. Resolve the inherited types first. 
		const superClasses = schemaType.inherits.map(superClassName => _getType(superClassName, rawSchemaTypes, comments))

		const superClassesWithInheritance = superClasses.map((superClass) => {
			if (!_inheritingIsAllowed(schemaType, superClass)){
				throw new Error('Schema error: ' + schemaType.type.toLowerCase() + ' ' + schemaType.name + ' cannot inherit from ' + superClass.type + ' ' + superClass.name + '.')  
			}            
			return _resolveSchemaType(superClass, rawSchemaTypes, comments)
		})

		// 4. Merge the super classes properties with the current schema type properties.
		const schemaTypeBlockProps = superClassesWithInheritance.length
			? superClassesWithInheritance.reduce((acc,superClass) => {
				const propertiesNotAlreadyIncluded = superClass.blockProps.filter(prop=> !acc.some(originalProp => originalProp.details.name == prop.details.name))
				acc.push(...propertiesNotAlreadyIncluded)
				return acc
			}, schemaType.blockProps)
			: schemaType.blockProps

		// 5. Resolve all generic properties. WARNING: This code creates side-effects by mutating '_memoizedConcreteGenericTypes'. 
		// This is the intended goal as '_memoizedConcreteGenericTypes' is used to in '_getSchemaBits' to get the new generic ASTs.
		_resolveGenericBlockProperies(schemaTypeBlockProps,rawSchemaTypes, comments)

		const objWithInheritance = {
			type: schemaType.type,
			name: schemaType.name,
			genericType: schemaType.genericType,
			originalBlockProps: schemaType.blockProps,
			metadata: schemaType.metadata || _.last(superClassesWithInheritance).metadata || null,
			directive: schemaType.directive,
			implements: _.toArray(_.uniq(_.concat(schemaType.implements, superClassesWithInheritance.implements).filter(function(x) {
				return x
			}))),
			inherits: superClassesWithInheritance,
			blockProps: schemaTypeBlockProps
		}

		memoizedExtendedObject[key] = objWithInheritance
		return _resolveUsingTrivialMethod(objWithInheritance, rawSchemaTypes, comments)
	})()

	// 4. Add comments
	return _addComments(resolvedType, comments)
}


const _getObjWithExtensions = (schemaType, rawSchemaTypes) => {
	if (schemaType && rawSchemaTypes && schemaType.inherits) {

		const key = `${schemaType.type}_${schemaType.name}_${schemaType.genericType}`
		if (memoizedExtendedObject[key]) return memoizedExtendedObject[key]

		const superClass = rawSchemaTypes.filter(function(x) {
			return schemaType.inherits.indexOf(x.name) > -1
		}).value()
		const superClassNames = rawSchemaTypes.map(function(x) {
			return x.name
		}).value()
		//find missing classes
		const missingClasses = _.difference(schemaType.inherits, superClassNames)

		missingClasses.forEach(function(c){
			throw new Error('Schema error: ' + schemaType.type.toLowerCase() + ' ' + schemaType.name + ' cannot find inherited ' + schemaType.type.toLowerCase() + ' ' + c)
		})

		const superClassesWithInheritance = superClass.map(function(subClass){

			if (!_inheritingIsAllowed(schemaType, subClass)){
				throw new Error('Schema error: ' + schemaType.type.toLowerCase() + ' ' + schemaType.name + ' cannot inherit from ' + subClass.type + ' ' + subClass.name + '.')  
			}            
			return _getObjWithExtensions(subClass, rawSchemaTypes)
		})

		const objWithInheritance = {
			type: schemaType.type,
			name: schemaType.name,
			genericType: schemaType.genericType,
			originalBlockProps: schemaType.blockProps,
			metadata: schemaType.metadata || _.last(superClassesWithInheritance).metadata || null,
			directive: schemaType.directive,
			implements: _.toArray(_.uniq(_.concat(schemaType.implements, superClassesWithInheritance.implements).filter(function(x) {
				return x
			}))),
			inherits: superClassesWithInheritance,
			blockProps: (superClassesWithInheritance instanceof Array ?
				_.toArray(_.flatten(_.concat(_.flatten(superClassesWithInheritance.map(function(subClass){
				return subClass.blockProps.filter(prop=>!schemaType.blockProps.find(originalProp=>originalProp.details.name==prop.details.name))
			})), schemaType.blockProps))):
				_.toArray(_.flatten(_.concat(superClassesWithInheritance.blockProps, schemaType.blockProps)))
			)
		}

		memoizedExtendedObject[key] = objWithInheritance
		return _resolveUsingTrivialMethod(objWithInheritance, rawSchemaTypes)
	}
	else
		return _resolveUsingTrivialMethod(schemaType)
}

const _inheritingIsAllowed = (obj, subClass) => {
	if (obj.type === 'TYPE')
		return subClass.type === 'TYPE' || subClass.type === 'INTERFACE'
	else 
		return obj.type === subClass.type
}

const _resolveUsingTrivialMethod = (obj, rawSchemaTypes, comments) => {
	if (obj && obj.blockProps)
		_resolveGenericBlockProperies(obj.blockProps, rawSchemaTypes, comments)
	if (obj && rawSchemaTypes && obj.implements && obj.implements.length > 0) {
		const interfaceWithAncestors = _.toArray(_.uniq(_.flatten(_.concat(obj.implements.map(i => _getInterfaceWithAncestors(i, rawSchemaTypes))))))
		return {
			type: obj.type,
			name: obj.name,
			genericType: obj.genericType,
			originalBlockProps: obj.blockProps,
			metadata: obj.metadata,
			implements: interfaceWithAncestors,
			inherits: obj.inherits,
			blockProps: obj.blockProps
		}
	}
	else
		return obj
}

let memoizedInterfaceWithAncestors = {}
const _getInterfaceWithAncestors = (_interface, schemaObjects) => {
	if (memoizedInterfaceWithAncestors[_interface]) return memoizedInterfaceWithAncestors[_interface]
	const interfaceObj = schemaObjects.filter(x => x.name == _interface)[0]
	if (!interfaceObj) throw new Error(`Schema error: interface ${_interface} is not defined.`)
	if (interfaceObj.type != 'INTERFACE') throw new Error(`Schema error: Schema property ${_interface} is not an interface. It cannot be implemented.`)

	const interfaceWithAncestors = interfaceObj.implements && interfaceObj.implements.length > 0
		? _.toArray(_.uniq(_.flatten(_.concat(
			[_interface],
			interfaceObj.implements,
			interfaceObj.implements.map(i => _getInterfaceWithAncestors(i, schemaObjects))))))
		: [_interface]

	memoizedInterfaceWithAncestors[_interface] = interfaceWithAncestors
	return interfaceWithAncestors
}

/**
 * Gets the text comment for a specific property. 
 * 
 * @param  {String}     property.type	Valid values: 'TYPE', 'ENUM', 'INPUT', 'INTERFACE', 'UNION', 'SCALAR'
 * @param  {String}     property.name	e.g., 'User'
 * @param  {[Comments]} comments		comments[].text, comments[].property.type, comments[].property.name 
 * @return {String}		output			Text.
 */
const _getPropertyComments = (property, comments) => {
	const { type, name } = property || {}
	if (!type || !name)
		return ''
	return ((comments || []).filter(c => c.property.type == type && c.property.name == name)[0] || {}).text || ''
}

const _addComments = (obj, comments) => {
	obj.comments = _getPropertyComments(obj, comments)
	return obj
}

const _parseSchemaObjToString = (comments, type, name, _implements, blockProps, extend=false, directive) =>
	[
		`${comments && comments != '' ? `\n${comments}` : ''}`,
		`${extend ? 'extend ' : ''}${type.toLowerCase()} ${name.replace('!', '')}${_implements && _implements.length > 0 ? ` implements ${_implements.join(', ')}` : ''} ${blockProps.some(x => x) ? `${directive ? ` ${directive} ` : ''}{`: ''} `,
		blockProps.map(prop => `    ${prop.comments != '' ? `${prop.comments}\n    ` : ''}${prop.value}`).join('\n'),
		blockProps.some(x => x) ? '}': ''
	].filter(x => x).join('\n')

/**
 * Tests if the type is a generic type based on the value of genericLetter
 *
 * @param  {String} type          e.g. 'Paged<T>', '[T]', 'T', 'T!'
 * @param  {String} genericLetter e.g. 'T', 'T,U'
 * @return {Boolean}              e.g. if type equals 'Paged<T>' or '[T]' and genericLetter equals 'T' then true.
 */
const SANITIZE_GEN_TYPE_REGEX = /^\[|\s|\](\s*)(!*)(\s*)$|!/g
const isTypeGeneric = (type, genericLetter) => {
	const sanitizedType = type ? type.replace(SANITIZE_GEN_TYPE_REGEX, '') : type
	const sanitizedgenericLetter = genericLetter ? genericLetter.replace(SANITIZE_GEN_TYPE_REGEX, '') : genericLetter
	if (!sanitizedType || !sanitizedgenericLetter)
		return false
	else if (sanitizedType == sanitizedgenericLetter)
		return true
	else if (sanitizedType.indexOf('<') > 0 && sanitizedType.indexOf('>') > 0) {
		const genericLetters = sanitizedgenericLetter.split(',')
		return (sanitizedType.match(/<(.*?)>/) || [null, ''])[1].split(',').some(x => genericLetters.some(y => y == x.trim()))
	}
	else
		return sanitizedgenericLetter.split(',').some(x => x.trim() == sanitizedType)
}


/**
 * [description]
 * @param  {String}		originName                 			e.g., 'Paged<Question>'. Original name from the non-compiled GraphQL schema.
 * @param  {Noolean}	isGen                      			Determines whether that type is generic or not.
 * @param  {String}		name                       			e.g., 'PagedQuestion'. Name of the new type once it has been compiled.
 * @param  {[Object]}	schemaBreakDown						Array of schema AST objects. This contains all the compiled types so far.
 * @param  {Object}		memoizedNewSchemaObjectFromGeneric	Memoized 'newGenericType' to speed up this function (e.g., { 'PagedQuestion': { obj:{...}, stringObj:'...' } })
 * 
 * @return {Object}		newGenericType
 * @return {Object}		newGenericType.obj					New generic type object's AST. 
 * @return {String}		newGenericType.stringObj			New generic type schema string definition (e.g., 'type PagedQuestion {\n data: [Question!]!\n cursor: ID\n }')
 */
const _createNewSchemaObjectFromGeneric = ({ originName, isGen, name }, schemaBreakDown, memoizedNewSchemaObjectFromGeneric) => {
	if (!memoizedNewSchemaObjectFromGeneric)
		throw new Error('Missing required argument. \'memoizedNewSchemaObjectFromGeneric\' is required.')
	if (isGen && memoizedNewSchemaObjectFromGeneric[name])
		return memoizedNewSchemaObjectFromGeneric[name]
	else if (isGen) {
		const genObjName = chain(originName.split('<')).next(parts => `${parts[0]}<`).val()
		const concreteType = (originName.match(/<(.*?)>/) || [null, null])[1]
		if (!concreteType) throw new Error(`Schema error: Cannot find generic type in object ${originName}`)
		const baseGenObj = schemaBreakDown.find(x => x.name.indexOf(genObjName) == 0)
		if (!baseGenObj) throw new Error(`Schema error: Cannot find any definition for generic type starting with ${genObjName}`)
		if (!baseGenObj.genericType) throw new Error(`Schema error: Schema object ${baseGenObj.name} is not generic!`)

		const blockProps = baseGenObj.blockProps.map(prop => {
			let p = prop
			if (isTypeGeneric(prop.details.result.name, baseGenObj.genericType)) {
				let details = {
					name: prop.details.name,
					params: prop.params,
					result: {
						originName: prop.details.originName,
						isGen: prop.details.isGen,
						name: _replaceGenericWithType(prop.details.result.name, baseGenObj.genericType.split(','), concreteType)
					}
				}
				if (prop.details.result.dependsOnParent) {
					const propTypeIsRequired = prop.details.result.name.match(/!$/)
					// e.g. [Paged<T>]
					const propTypeName = propTypeIsRequired ? prop.details.result.name.replace(/!$/,'') : prop.details.result.name
					const propTypeIsArray = propTypeName.match(/^\[.*\]$/)
					// e.g. [Paged<Product>]
					const originalConcretePropType = _replaceGenericWithType(propTypeName, prop.details.result.genericParentTypes, concreteType)
					// e.g. Paged<Product>
					const concretePropType = propTypeIsArray ? originalConcretePropType.replace(/^\[|\]$/g,'') : originalConcretePropType
					const concreteGenProp = _getTypeDetails(concretePropType, prop.details.result.metadata)
					// e.g. PagedProduct
					const concreteGenPropName = _createNewSchemaObjectFromGeneric(concreteGenProp, schemaBreakDown, memoizedNewSchemaObjectFromGeneric).obj.name
					// e.g. [PagedProduct]
					let originalConcretePropTypeName = propTypeIsArray ? `[${concreteGenPropName}]` : concreteGenPropName
					// e.g. [PagedProduct]!
					originalConcretePropTypeName = originalConcretePropTypeName + (propTypeIsRequired ? '!' : '')
					// e.g. [PagedProduct]! @isAuthenticated
					originalConcretePropTypeName = prop.details.result.directive ? `${originalConcretePropTypeName} ${prop.details.result.directive}` : originalConcretePropTypeName
					details.result = {
						originName: prop.details.result.directive ? `${prop.details.result.name} ${prop.details.result.directive}` : prop.details.result.name,
						isGen: true,
						name: originalConcretePropTypeName
					}
				}

				p = {
					comments: prop.comments,
					details: details,
					value: _getPropertyValue(details)
				}
			}

			return p
		})

		const newSchemaObjStr = _parseSchemaObjToString(baseGenObj.comments, baseGenObj.type, name, baseGenObj.implements, blockProps)
		const result = {
			obj: {
				comments: baseGenObj.comments,
				type: baseGenObj.type,
				name,
				implements: baseGenObj.implements,
				blockProps: blockProps,
				genericType: null
			},
			stringObj: newSchemaObjStr
		}
		memoizedNewSchemaObjectFromGeneric[name] = result
		return result
	}
	else return { obj: null, stringObj: null }
}

/**
 * Breaks down a schema into its bits and pieces.
 * @param  {String}  graphQlSchema
 * @param  {Array}   metadata
 * @param  {Boolean} includeNewGenTypes
 * @return {String}  result.type 		e.g. 'TYPE', 'INTERFACE'
 * @return {Boolean} result.raw
 * @return {Boolean} result.extend
 * @return {String}  result.name
 * @return {String}  result.metadata
 * @return {Boolean} result.genericType
 * @return {String}  result.blockProps
 * @return {Boolean} result.inherits
 * @return {String}  result.implements
 * @return {String}  result.comments
 */
const getSchemaParts = (graphQlSchema, metadata) => {
	metadata = metadata || []
	// 1. Extract all the comments
	const comments = _getCommentsBits(graphQlSchema)
	// 2. Extract all the blocks stripped out of all the comments. 
	const schemaBits = _getSchemaBits(graphQlSchema)
	// 3. Classify the blocks in AST objects
	const rawSchemaTypes = [_getInterfaces, _getAbstracts, _getTypes, _getInputs, _getEnums, _getScalars, _getUnions].reduce((acc, getObjects) => {
		// 3.1. Creates the type
		const schemaTypes = getObjects(schemaBits,metadata) || []
		acc.push(...schemaTypes)
		return acc
	},[])

	// 4. Resolve all generic params names and memoize them.
	const rawParamGenericTypes = Object.keys(memoizedGenericSchemaObjects)
		.map(key => memoizedGenericSchemaObjects[key])
		.filter(({ paramName, isGen }) => paramName && isGen)

	rawParamGenericTypes.map(({ originName, name }) => 
		_resolveGenericType({ concreteGenericTypeName:originName, rawSchemaTypes, comments, aliasName:name }))

	// 5. Resolve all types
	const resolvedTypes = rawSchemaTypes.map(schemaType => {
		const resolvedSchemaType = _resolveSchemaType(schemaType, rawSchemaTypes, comments)
		return resolvedSchemaType
	})

	// 6. Include the generic types that were resolved as a side-effect of resolving the other types in step #4.
	const resolvedGenericTypes = Object.keys(_memoizedConcreteGenericTypes).map(key => _memoizedConcreteGenericTypes[key])
	const allTypes = [...resolvedTypes,...resolvedGenericTypes]

	// 7. Include directives.
	const directives = (metadata || []).filter(m => m.directive)
	if (directives.length > 0) {
		allTypes.push(...directives.map(d => ({
			type: 'DIRECTIVE',
			name: d.name,
			raw: (d.body || '').replace(/░/g, '\n'),
			extend: false,
			metadata: null,
			genericType: null,
			blockProps: [],
			inherits: null,
			implements: null,
			comments: undefined
		})))
	}

	return allTypes
}

const resetMemory = () => {
	_s = {}
	_memoizedConcreteGenericTypes = null
	_memoizedConcreteGenericTypes = {}
	memoizedGenericSchemaObjects = null
	memoizedGenericSchemaObjects = {}
	memoizedExtendedObject = null
	memoizedExtendedObject = {}
	memoizedInterfaceWithAncestors = null
	memoizedInterfaceWithAncestors = {}
	memoizedGenericNameAliases = null
	memoizedGenericNameAliases = {}
	memoizedAliases = null
	return 1
}

const _buildASTs = (ASTs=[]) => {
	const part_01 = ASTs
		.filter(x => !x.genericType && x.type != 'ABSTRACT' && x.type != 'DIRECTIVE')
		.map(obj => _parseSchemaObjToString(obj.comments, obj.type, obj.name, obj.implements, obj.blockProps, obj.extend, obj.directive))
		.join('\n')

	const directives = ASTs.filter(x => x.type == 'DIRECTIVE' && x.raw).map(x => x.raw).join('')

	return directives + '\n' + part_01
}

const getSchemaAST = graphQlSchema => {
	resetMemory()
	const { stdSchema, metadata } = removeGraphMetadata(graphQlSchema)
	const ASTs = getSchemaParts(stdSchema, metadata, true)
	resetMemory()
	return ASTs
}

const transpile = graphQlSchema => {
	const ASTs = getSchemaAST(graphQlSchema)
	const build = _buildASTs(ASTs)
	return build
}

let graphqls2s = {
	getSchemaAST,
	transpileSchema: transpile,
	extractGraphMetadata,
	getGenericAlias,
	getQueryAST,
	buildQuery,
	isTypeGeneric
}


if (typeof(window) != 'undefined') window.graphqls2s = graphqls2s

module.exports.graphqls2s = graphqls2s

