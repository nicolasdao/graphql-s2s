/**
 * Copyright (c) 2017, Neap Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const _ = require('lodash')
const { chain, log, escapeGraphQlSchema, removeMultiSpaces, matchLeftNonGreedy } = require('./utilities')

const carrReturnEsc = '_cr_'
const tabEsc = '_t_'

/**
 * Extracts the graph metadata from a GraphQL schema in order to produce graph visualization (e.g. D3.js)
 * 
 * @param  {string} schema 					GraphQL schema containing Graph metadata (e.g. @node, @edge, ...)
 * @return {object} graphMetadata   		Graph Metadata with the standard version of the GraphQL Schema (i.e. without the metadata @node, @edge, ...)
 * @return {object} graphMetadata.metadata  Graph Metadata
 * @return {string} graphMetadata.stdSchema Standard version of the GraphQL Schema (i.e. without the metadata @node, @edge, ...) 
 */
const extractGraphMetadata = (schema = '') => {
	const escSchema = escapeGraphQlSchema(schema, carrReturnEsc, tabEsc).replace(/_t_/g, ' ')
	const attrMatches = escSchema.match(/@(.*?)(_cr_)(.*?)({|_cr_)/mg)
	const graphQlMetadata = chain(_(attrMatches).map(m => chain(m.split(carrReturnEsc)).next(parts => {
		if (parts.length < 2) throw new Error(`Schema error: Misused metadata attribute in '${parts.join(' ')}.'`)
		const typeMatch = `${parts[0].trim()} `.match(/@(.*?)(\s|{|\(|\[)/)
		if (!typeMatch) {const msg = `Schema error: Impossible to extract type from metadata attribute ${parts[0]}`; log(msg); throw new Error(msg)}
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
					const parentSchemaTypeName = m2[2].replace(/{/g, ' ').replace(/_cr_/g, ' ').trim().split(' ')[0]
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
	.next(metadata => _.toArray(metadata))
	.val()

	return graphQlMetadata
}

const removeGraphMetadata = (schema = '') => 
	escapeGraphQlSchema(schema, carrReturnEsc, tabEsc).replace(/_t_/g, ' ').replace(/@(.*?)_cr_/g, '').replace(/_cr_/g, '\n')

module.exports = {
	extractGraphMetadata,
	removeGraphMetadata
}



