/**
 * Copyright (c) 2018, Neap Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const _ = require('lodash')
const { chain, log, escapeGraphQlSchema, removeMultiSpaces, matchLeftNonGreedy, newShortId } = require('./utilities')

const carrReturnEsc = '░'
const tabEsc = '_t_'

/**
 * Remove directives
 * @param  {String} schema 										Escaped schema (i.e., without tabs or carriage returns. The CR have been replaced by '░' ) 
 * @return {String} output.schema 								Schema without directives
 * @return {Array} 	output.directives
 * @return {String} output.directives[0].name  					Directive's name
 * @return {String} output.directives[0].definition  			Directive's definition
 * @return {Array} 	output.directives[0].instances  	
 * @return {String} output.directives[0].instances[0].id 		Unique identifier that replaces the directive's instance value
 * @return {String} output.directives[0].instances[0].value 	Directive's instance value
 */
const removeDirectives = (schema = '') => {
	if (!schema)
		return { schema, directives:null }

	schema += '░'
	const directives = []
	const d = schema.match(/directive\s(.*?)@(.*?)(\((.*?)\)\son\s(.*?)░|\son\s(.*?)░)/mg) || []
	d.forEach(directive => {
		const directiveName = directive.match(/@(.*?)[\s(]/)[0].replace(/(░)\s/g,'').trim().replace('(','')
		schema = schema.replace(directive, '')
		if (!schema.match(/░$/))
			schema += '░'

		const dInstances = schema.match(new RegExp(`${directiveName}(.*?)░`, 'g')) || []
		const instances = []
		dInstances.forEach(dInst => {
			const id = `_${newShortId()}_`
			const inst = dInst.replace(/░$/,'')
			schema = schema.replace(inst, id)
			instances.push({ id, value: inst })
		})

		directives.push({ name: directiveName.replace('@',''), body: directive, directive: true, directiveValues: instances })
	})

	// Get the rogue directives, i.e., the directives defined immediately after a field (must be on the same line)
	// and have not been escaped before because they do not have an explicit definition in the current schema (scenario
	// of AWS AppSync where the @aws_subscribe is defined outside of the developer reach)
	// 
	// IMPORTANT: The code below mutates the 'schema' variable
	const rogueDirectives = (schema.match(/░\s*[a-zA-Z0-9_]+([^░]*?)@(.*?)░/g) || [])
	.map(m => m.replace(/^(.*?)@/, '@').replace(/\s*░$/, ''))
	.reduce((acc,m) => {
		m = m.trim().replace(/{$/, '')
		const directiveName = m.match(/^@[a-zA-Z0-9_]+/)[0].slice(1)
		const directiveInstanceId = `_${newShortId()}_`
		schema = schema.replace(m, directiveInstanceId)
		if (acc[directiveName]) 
			acc[directiveName].directiveValues.push({ id: directiveInstanceId, value: m })
		else {
			acc.push(directiveName)
			acc[directiveName] = {
				name: directiveName,
				body: '',
				directive: true,
				directiveValues: [{ id: directiveInstanceId, value: m }]
			}
		}
		return acc
	}, [])

	if (rogueDirectives.length > 0)
		directives.push(...rogueDirectives.map(x => rogueDirectives[x]))

	return { schema, directives }
}

const reinsertDirectives = (schema='', directives=[]) => {
	if (!schema)
		return schema

	const directiveDefinitions = directives.map(x => x.body).join('░')
	directives.forEach(({ directiveValues=[] }) => directiveValues.forEach(({ id, value }) => {
		schema = schema.replace(id, value)
	}))

	return `${directiveDefinitions}${schema}`
}

/**
 * Extracts the graph metadata as well as the directives from a GraphQL schema 
 * 
 * @param  {string} schema 						GraphQL schema containing Graph metadata (e.g. @node, @edge, ...)
 * @return {Array} 	graphMetadata  
 * @return {String} graphMetadata.escSchema		Escaped schema	
 * @return {String} graphMetadata[0].name
 * @return {String} graphMetadata[0].body
 * @return {String} graphMetadata[0].schemaType
 * @return {String} graphMetadata[0].schemaName
 * @return {String} graphMetadata[0].parent
 * @return {String} graphMetadata[0].directive
 * @return {String} graphMetadata[0].directiveValues
 */
const extractGraphMetadata = (schema = '') => {
	const { schema:escSchema, directives } = removeDirectives(escapeGraphQlSchema(schema, carrReturnEsc, tabEsc).replace(/_t_/g, ' '))
	const attrMatches = escSchema.match(/@(.*?)(░)(.*?)({|░)/mg)
	let graphQlMetadata = chain(_(attrMatches).map(m => chain(m.split(carrReturnEsc)).next(parts => {
		if (parts.length < 2) 
			throw new Error(`Schema error: Misused metadata attribute in '${parts.join(' ')}.'`)
		
		const typeMatch = `${parts[0].trim()} `.match(/@(.*?)(\s|{|\(|\[)/)
		if (!typeMatch) {
			const msg = `Schema error: Impossible to extract type from metadata attribute ${parts[0]}`
			log(msg)
			throw new Error(msg)
		}

		const attrName = typeMatch[1].trim()
		const attrBody = parts[0].replace(`@${attrName}`, '').trim()

		const { schemaType, value } = chain(removeMultiSpaces(parts[1].trim())).next(t => t.match(/^(type\s|input\s|enum\s|interface\s)/)
			? chain(t.split(' ')).next(bits => ({ schemaType: bits[0].toUpperCase(), value: bits[1].replace(/ /g, '').replace(/{$/, '') })).val()
			: { schemaType: 'PROPERTY', value: t }).val()

		const parent = schemaType == 'PROPERTY' 
			? chain(escSchema.split(m).join('___replace___')).next(s => matchLeftNonGreedy(s, '(type |input |enum |interface )', '___replace___'))
				.next(m2 => {
					if (!m2) throw new Error(`Schema error: Property '${value}' with metadata '@${value}' does not live within any schema type (e.g. type, enum, interface, input, ...)`)
					const parentSchemaType = m2[1].trim().toUpperCase()
					const parentSchemaTypeName = m2[2].replace(/{/g, ' ').replace(/░/g, ' ').trim().split(' ')[0]
					return { type: parentSchemaType, name: parentSchemaTypeName }
				})
				.val()
			: null
		
		return { name: attrName, body: attrBody, schemaType: schemaType, schemaName: value, parent: parent }
	}).val()))
	.next(metadata => metadata.map(m => m.schemaType == 'PROPERTY' 
		? (m.parent 
			? chain(metadata.find(x => x.schemaType == m.parent.type && x.schemaName == m.parent.name))
				.next(v => v ? (() => { m.parent.metadata = { type: v.schemaType, name: v.name }; return m })() : m)
				.val() 
			: m)
		: m))
	.next(metadata => _.toArray(metadata).concat(directives))
	.val() || []

	graphQlMetadata.escSchema = escSchema

	return graphQlMetadata
}

const removeGraphMetadata = (schema = '') => {
	const meta = extractGraphMetadata(schema) || []
	const directives = meta.filter(m => m.directive)
	const schemaWithNoMeta = (reinsertDirectives(meta.escSchema.replace(/@(.*?)░/g, ''), directives) || '').replace(/░/g, '\n')
	return { stdSchema: schemaWithNoMeta, metadata: meta }
}

module.exports = {
	extractGraphMetadata,
	removeGraphMetadata
}



