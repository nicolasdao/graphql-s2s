/**
 * Copyright (c) 2017, Neap Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const _ = require('lodash')
const { chain, log, escapeGraphQlSchema } = require('./src/utilities')
const { extractGraphMetadata, removeGraphMetadata } = require('./src/graphmetadata')

const genericTypeRegEx = /<(.*?)>/
const typeNameRegEx = /type\s(.*?){/
const typeRegex = /type\s(.*?){(.*?)_cr_([^#]*?)}/mg
const inputNameRegEx = /input\s(.*?){/
const inputRegex = /input\s(.*?){(.*?)_cr_([^#]*?)}/mg
const enumNameRegEx = /enum\s(.*?){/
const enumRegex = /enum\s(.*?){(.*?)_cr_([^#]*?)}/mg
const interfaceNameRegEx = /interface\s(.*?){/
const interfaceRegex = /interface\s(.*?){(.*?)_cr_([^#]*?)}/mg
const abstractNameRegEx = /abstract\s(.*?){/
const abstractRegex = /abstract\s(.*?){(.*?)_cr_([^#]*?)}/mg
const inheritsRegex = /inherits\s(.*?)\s/mg
const implementsRegex = /implements\s(.*?)\{/mg
const propertyParamsRegEx = /\((.*?)\)/

const carrReturnEsc = '_cr_'
const tabEsc = '_t_'

let s = null
const escapeGraphQlSchemaPlus = (sch, cr, t) => s || (() => { s = escapeGraphQlSchema(sch, cr, t); return s })()

const getSchemaBits = (sch) => _.flatten(_.toArray(_([typeRegex, inputRegex, enumRegex, interfaceRegex, abstractRegex])
	.map(rx => _.toArray(_(escapeGraphQlSchemaPlus(sch, carrReturnEsc, tabEsc).match(rx)).map(str => {
		const blockMatch = str.match(/{(.*?)_cr_([^#]*?)}/)
		if (!blockMatch) throw new Error('Schema error: Missing block')
		const block = _.toArray(_(blockMatch[0].replace(/_t_/g, '').replace(/^{/,'').replace(/}$/,'').split(carrReturnEsc).map(x => x.trim())).filter(x => x != ''))
		const property = str.split(carrReturnEsc).join(' ').split(tabEsc).join(' ').replace(/ +(?= )/g,'')
		return { property, block }
	})))))

const getSchemaEntity = firstLine => 
	firstLine.indexOf('type') == 0 ? { type: 'TYPE', name: firstLine.replace('type', '').replace(/ /g, '').replace('{', '') } :
	firstLine.indexOf('enum') == 0 ? { type: 'ENUM', name: firstLine.replace('enum', '').replace(/ /g, '').replace('{', '') } :
	firstLine.indexOf('input') == 0 ? { type: 'INPUT', name: firstLine.replace('input', '').replace(/ /g, '').replace('{', '') } :
	firstLine.indexOf('interface') == 0 ? { type: 'INTERFACE', name: firstLine.replace('interface', '').replace(/ /g, '').replace('{', '') } :
	{ type: null, name: null }

const getCommentsBits = (sch) => _.toArray(
	_(escapeGraphQlSchemaPlus(sch, carrReturnEsc, tabEsc).match(/#(.*?)_cr_([^#]*?)({|:)/g) || [])
	.filter(x => x.match(/{$/))
	.map(c => {
		const parts = _(c.split(carrReturnEsc).map(l => l.replace(/_t_/g, '    ').trim())).filter(x => x != '')
		const hashCount = parts.reduce((a,b) => a + (b.indexOf('#') == 0 ? 1 : 0), 0)
		return { text: parts.initial(), property: getSchemaEntity(parts.last()), comments: hashCount == parts.size() - 1 }
	})
	.filter(x => x.comments).map(x => ({ text: x.text.join('\n'), property: x.property }))
)

const genericNameAlias = genName => chain(genName.match(genericTypeRegEx)).next(m => m 
	? chain(genName.split(m[0])).next(parts => `${parts[0]}${m[1].split(',').map(x => x.trim()).join('')}`).val()
	: genName).val()

/**
 * Example: [T] -> [User], or T -> User or Toy<T> -> Toy<User>
 * @param  {string} genericType   e.g. Toy<T>
 * @param  {string} genericLetter e.g. T
 * @param  {string} concreteType  e.g. User
 * @return {string}               e.g. Toy<User>
 */
const replaceGenericWithType = (genericType, genericLetter, concreteType) => 
	chain({ gType: genericType.trim(), gLetter: genericLetter.trim(), cType: concreteType.trim() })
	.next(({ gType, gLetter, cType }) => 
		gType == gLetter ? cType :
		gType.indexOf('[') == 0 && gType.indexOf(']') > 0  ? `[${gType.match(/\[(.*?)\]/)[1].replace(genericLetter, concreteType)}]` :
		gType.indexOf('<') > 0 && gType.indexOf('>') > 0  ? chain(gType.match(/(.*?)<(.*?)>/)).next(match => `${match[1]}<${match[2].replace(genericLetter, concreteType)}>`).val() : 
		(() => { throw new Error(`Schema error: Cannot replace generic type '${gLetter}' of generic object '${gType}' with type '${cType}'`) })()
	)
	.val()

let memoizedGenericSchemaObjects = {}
const getTypeDetails = t => chain(({ originName: t, isGen: t.indexOf('<') > 0, name: genericNameAlias(t) }))
	.next(result => {
		if (result.isGen && !memoizedGenericSchemaObjects[result.name])
			memoizedGenericSchemaObjects[result.name] = result
		return result
	})
	.val()

const getPropertyValue = ({ name, params, result }, mapResultName) => 
	`${name}${params ? `(${params})` : ''}${result && result.name ? `: ${mapResultName ? mapResultName(result.name) : result.name}` : ''}`

/**
 * Breaks down a string representing a block { ... } into its various parts.
 * @param  {string} blockParts 								String representing your entire block (e.g. { users: User[], posts: Paged<Post> })
 * @param  {object} baseObj 								
 * @param  {string} baseObj.type 							Type of the object with blockParts (e.g. TYPE, ENUM, ...)
 * @param  {string} baseObj.name 							Name of the object with blockParts
 * @param  {array}  metadata 								Array of object. Each object represents a metadata. Example: { name: 'node', body: '(name:hello)', schemaType: 'PROPERTY', schemaName: 'rating: PostRating!', parent: { type: 'TYPE', name: 'PostUserRating', metadata: [Object] } }
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
const getBlockProperties = (blockParts, baseObj, metadata) => 
	chain(_(metadata).filter(m => m.schemaType == 'PROPERTY' && m.parent && m.parent.type == baseObj.type && m.parent.name == baseObj.name))
	.next(meta => _(blockParts).reduce((a, part) => {
		const p = part.trim()
		const mData = meta.filter(m => m.schemaName == p).first() || null 
		if (p.indexOf('#') == 0)
			a.comments.push(p)
		else {
			const prop = p.replace(/ +(?= )/g,'').replace(/,$/, '')
			const paramsMatch  = prop.match(propertyParamsRegEx)
			const propDetails = paramsMatch 
				? chain(prop.split(paramsMatch[0]))
					.next(parts => ({ name: parts[0].trim(), metadata: mData, params: paramsMatch[1], result: getTypeDetails((parts[1] || '').replace(':', '').trim()) })).val()
				: chain(prop.split(':'))
					.next(parts => ({ name: parts[0], metadata: mData, params: null, result: getTypeDetails((parts[1] || '').trim()) })).val()
			a.props.push({ 
				comments: a.comments.join('\n    '), 
				details: propDetails,
				value: getPropertyValue(propDetails)
			})
			a.comments = []
		}
		return a
	}, { comments:[], props:[] }).props)
	.val()

const getSchemaObject = (definitions, typeName, nameRegEx, metadata) => 
	_.toArray(_(definitions).filter(d => d.property.indexOf(typeName) == 0)
	.map(d => {
		const typeDefMatch = d.property.match(/(.*?){/)
		if (!typeDefMatch || typeDefMatch[0].indexOf('#') >= 0) throw new Error(`Schema error: Syntax error in '${d.property}'. Cannot any find schema type definition.`)
		const typeDef = typeDefMatch[0]
		const nameMatch = typeDef.match(nameRegEx)
		if (!nameMatch) throw new Error(`Schema error: ${typeName} with missing name.`)
		const name = nameMatch[1].trim().split(' ')[0]
		const typeMatch = name.match(genericTypeRegEx)
		const type = typeMatch ? typeMatch[1] : null
		const inheritsMatch = typeDef.match(inheritsRegex)
		const superClass = inheritsMatch 
			? inheritsMatch[0].replace('inherits ', '').replace(',', '').trim()
			: null
		const implementsMatch = typeDef.match(implementsRegex)
		const _interface = implementsMatch 
			? implementsMatch[0].replace('implements ', '').replace('{', '').split(',').map(x => x.trim().split(' ')[0]) 
			: null

		const objectType = typeName.toUpperCase()
		const metadat = metadata
			? _(metadata).filter(m => m.schemaType == objectType && m.schemaName == name).first() || null
			: null 

		const baseObj = { type: objectType, name: name }
		return { type: objectType, name: name, metadata: metadat, genericType: type, blockProps: getBlockProperties(d.block, baseObj, metadata), inherits: superClass, implements: _interface  }
	}))

const getInterfaces = (definitions, metadata) => getSchemaObject(definitions, 'interface', interfaceNameRegEx, metadata)

const getAbstracts = (definitions, metadata) => getSchemaObject(definitions, 'abstract', abstractNameRegEx, metadata)

const getTypes = (definitions, metadata) => getSchemaObject(definitions, 'type', typeNameRegEx, metadata)

const getInputs = (definitions, metadata) => getSchemaObject(definitions, 'input', inputNameRegEx, metadata)

const getEnums = (definitions, metadata) => getSchemaObject(definitions, 'enum', enumNameRegEx, metadata)

let memoizedExtendedObject = {}
const getObjWithExtensions = (obj, schemaObjects) => {
	if (obj && schemaObjects && obj.inherits) {
		const key = `${obj.type}_${obj.name}_${obj.genericType}`
		if (memoizedExtendedObject[key]) return memoizedExtendedObject[key]

		const superClass = schemaObjects.filter(x => x.name == obj.inherits).first()
		if (!superClass) throw new Error(`Schema error: ${obj.type.toLowerCase()} ${obj.name} cannot find inherited ${obj.type.toLowerCase()} ${obj.inherits}`)
		if (obj.type != superClass.type) throw new Error(`Schema error: ${obj.type.toLowerCase()} ${obj.name} cannot inherit from ${superClass.type} ${superClass.name}. A ${obj.type.toLowerCase()} can only inherit from another ${obj.type.toLowerCase()}`)

		const superClassWithInheritance = getObjWithExtensions(superClass, schemaObjects)

		const objWithInheritance = { 
			type: obj.type, name: obj.name, genericType: obj.genericType, originalBlockProps: obj.blockProps, 
			metadata: obj.metadata || superClassWithInheritance.metadata || null,
			implements: _.toArray(_.uniq(_.concat(obj.implements, superClassWithInheritance.implements).filter(x => x))),
			inherits: superClassWithInheritance,
			blockProps: _.toArray(_.flatten(_.concat(superClassWithInheritance.blockProps, obj.blockProps)))
		}

		memoizedExtendedObject[key] = objWithInheritance
		return getObjWithInterfaces(objWithInheritance, schemaObjects)
	}
	else
		return getObjWithInterfaces(obj)
}

const getObjWithInterfaces = (obj, schemaObjects) => {
	if (obj && schemaObjects && obj.implements && obj.implements.length > 0) {
		const interfaceWithAncestors = _.toArray(_.uniq(_.flatten(_.concat(obj.implements.map(i => getInterfaceWithAncestors(i, schemaObjects))))))
		return { 
			type: obj.type, name: obj.name, genericType: obj.genericType, originalBlockProps: obj.blockProps, 
			implements: interfaceWithAncestors,
			inherits: obj.inherits,
			blockProps: obj.blockProps
		}
	}
	else
		return obj
}

let memoizedInterfaceWithAncestors = {}
const getInterfaceWithAncestors = (_interface, schemaObjects) => {
	if (memoizedInterfaceWithAncestors[_interface]) return memoizedInterfaceWithAncestors[_interface]
	const interfaceObj = schemaObjects.filter(x => x.name == _interface).first()
	if (!interfaceObj) throw new Error(`Schema error: interface ${_interface} is not defined.`)
	if (interfaceObj.type != 'INTERFACE') throw new Error(`Schema error: Schema property ${_interface} is not an interface. It cannot be implemented.`)

	const interfaceWithAncestors = interfaceObj.implements && interfaceObj.implements.length > 0
		? _.toArray(_.uniq(_.flatten(_.concat(
			[_interface], 
			interfaceObj.implements, 
			interfaceObj.implements.map(i => getInterfaceWithAncestors(i, schemaObjects))))))
		: [_interface]

	memoizedInterfaceWithAncestors[_interface] = interfaceWithAncestors
	return interfaceWithAncestors
}

const addComments = (obj, comments) => {
	obj.comments = _(comments).filter(c => c.property.type == obj.type && c.property.name == obj.name).map(x => x.text).first()
	return obj
}

const parseSchemaObjToString = (comments, type, name, _implements, blockProps) => [
		`${comments && comments != '' ? `\n${comments}` : ''}`, 
		`${type.toLowerCase()} ${name}${_implements && _implements.length > 0 ? ` implements ${_implements.join(', ')}` : ''} { `,
		blockProps.map(prop => `    ${prop.comments != '' ? `${prop.comments}\n    ` : ''}${prop.value}`).join('\n'),
		'}'
	].join('\n')

const isTypeGeneric = (type, genericLetter) => 
	!type || !genericLetter ? false :
	type == genericLetter ? true :
	type.indexOf('[') == 0 && type.indexOf(']') > 0 ? _(type.match(/\[(.*?)\]/)[1].split(',')).some(x => x.trim() == genericLetter) :
	type.indexOf('>') > 0 && type.indexOf('>') > 0 ? _(type.match(/<(.*?)>/)[1].split(',')).some(x => x.trim() == genericLetter) :
	false

let memoizedNewSchemaObjectFromGeneric = {}
const createNewSchemaObjectFromGeneric = ({ originName, isGen, name }, schemaBreakDown) => {
	if (isGen && !memoizedNewSchemaObjectFromGeneric[name]) {
		const genObjName = chain(originName.split('<')).next(parts => `${parts[0]}<`).val()
		const concreteType = (originName.match(/<(.*?)>/) || [null, null])[1]
		if (!concreteType) throw new Error(`Schema error: Cannot find generic type in object ${originName}`)
		const baseGenObj = schemaBreakDown.find(x => x.name.indexOf(genObjName) == 0)
		if (!baseGenObj) throw new Error(`Schema error: Cannot find any definition for generic type starting with ${baseGenObjName}`)
		if (!baseGenObj.genericType) throw new Error(`Schema error: Schema object ${baseGenObj.name} is not generic!`)

		const blockProps = baseGenObj.blockProps.map(prop => isTypeGeneric(prop.details.result.name, baseGenObj.genericType)
			? chain({ name: prop.details.name, params: prop.params, result: {
							originName: prop.details.originName,
							isGen: prop.details.isGen,
							name: replaceGenericWithType(prop.details.result.name, baseGenObj.genericType, concreteType)
						} 
					}
				)
				.next(details => ({ 
					comments: prop.comments, 
					details: details,
					value: getPropertyValue(details)
				})).val()
			: prop)
		const newSchemaObjStr = parseSchemaObjToString(baseGenObj.comments, baseGenObj.type, name, baseGenObj.implements, blockProps)
		return { 
			obj: { comments: baseGenObj.comments, type: baseGenObj.type, name: name, implements: baseGenObj.implements, blockProps: blockProps, genericType: null },
			stringObj: newSchemaObjStr
		}
	}
	else return { obj: null, stringObj: null }
}

const buildSchemaString = schemaObjs => _(schemaObjs)
	.filter(x => !x.genericType && x.type != 'ABSTRACT')
	.map(obj => parseSchemaObjToString(obj.comments, obj.type, obj.name, obj.implements, obj.blockProps))
	.join('\n') + 
	_(memoizedGenericSchemaObjects)
	.map((value, key) => createNewSchemaObjectFromGeneric(value, schemaObjs).stringObj)
	.join('\n')

const getSchemaParts = (graphQlSchema, metadata, includeNewGenTypes) => chain(_([getInterfaces, getAbstracts, getTypes, getInputs, getEnums]
		.reduce((objects, getObjects) => objects.concat(getObjects(getSchemaBits(graphQlSchema), metadata)), [])))
	.next(firstSchemaBreakDown => _.toArray(firstSchemaBreakDown
		.map(obj => getObjWithExtensions(obj, firstSchemaBreakDown))
		.map(obj => addComments(obj, getCommentsBits(graphQlSchema)))))
	.next(v => includeNewGenTypes 
		? v.concat(_.toArray(_(memoizedGenericSchemaObjects).map((value, key) => createNewSchemaObjectFromGeneric(value, v).obj)))
		: v)
	.val()

const resetMemory = () => {
	s = null
	memoizedGenericSchemaObjects = {}
	memoizedExtendedObject = {}
	memoizedInterfaceWithAncestors = {}
	memoizedNewSchemaObjectFromGeneric = {}
	return 1
}

module.exports = {
	getSchemaAST: (graphQlSchema) => chain(resetMemory())
		.next(v => ({ metadata: extractGraphMetadata(graphQlSchema), stdSchema: removeGraphMetadata(graphQlSchema) }))
		.next(metadata => getSchemaParts(metadata.stdSchema, metadata.metadata, true))
		.next(v => { resetMemory(); return v })
		.val(),
	transpileSchema: (graphQlSchema) => chain(resetMemory())
		.next(v => buildSchemaString(getSchemaParts(removeGraphMetadata(graphQlSchema))))
		.next(v => { resetMemory(); return v })
		.val(),
	extractGraphMetadata: extractGraphMetadata
}