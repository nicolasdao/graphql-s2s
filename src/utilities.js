/** * Copyright (c) 2018, Neap Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const { parse } = require('./graphql/parser')

let _start
const startTime = anything => {
    _start = Date.now()
    return anything
}
const logTime = (anything, label) => {
    if (!_start)
        _start = Date.now()
    console.log(label ? `${label}: ${Date.now() - _start} ms`: `${Date.now() - _start} ms`)
    return anything
}

const chain = value => ({ next: fn => chain(fn(value)), val: () => value })
/*eslint-disable */
const log = (msg, name, transformFn) => chain(name ? `${name}: ${typeof(msg) != 'object' ? msg : JSON.stringify(msg)}` : msg)
    /*eslint-disable */
    .next(v => transformFn ? console.log(chain(transformFn(msg)).next(v => name ? `${name}: ${v}` : v).val()) : console.log(v))
    /*eslint-enable */
    .next(() => msg)
    .val()
/*eslint-enable */
/**
 * Removes all multi-spaces with a single space + replace carriage returns with 'cr' and tabs with 't'
 * @param  {String} sch Text input
 * @param  {String} cr  Carriage return replacement
 * @param  {String} t   Tab replacement
 * @return {String}     Escaped text
 */
const escapeGraphQlSchema = (sch, cr='_cr_', t=' ') => sch.replace(/[\n\r]+/g, cr).replace(/[\t\r]+/g, t).replace(/\s+/g, ' ')
const removeMultiSpaces = s => s.replace(/ +(?= )/g,'')
const matchLeftNonGreedy = (str, startChar, endChar) => chain(str.match(new RegExp(`${startChar}(.*?)${endChar}`)))
    .next(m => m && m.length > 0
        ? chain(matchLeftNonGreedy(`${m[m.length-1]}${endChar}`, startChar, endChar)).next(v => v ? v : m).val()
        : m
    )
    .val()

const throwError = (v, msg) => v ? (() => {throw new Error(msg)})() : true

/**
 * Check whether or not the 'type' that is defined in the 'schemaAST' is of type node.
 * 
 * @param  {String}   type      Type name
 * @param  {Array}    schemaAST Array of schema objects
 * @return {Boolean}            Result
 */
const GRAPHQLSCALARTYPES = { 'ID': true, 'String': true, 'Float': true, 'Int': true, 'Boolean': true  }
const isNodeType = (type, schemaAST) => 
    chain(throwError(!type, 'Error in method \'isNodeType\': Argument \'type\' is required.'))
        .next(() => type.replace(/!$/, ''))
        .next(type => (type.match(/^\[(.*?)\]$/) || [null, type])[1])
        .next(type => GRAPHQLSCALARTYPES[type] 
            ? false 
            :   chain({ type, typeAST: schemaAST.find(x => x.name == type)})
                .next(({type, typeAST}) => !typeAST 
                    ? throwError(true, `Error in method 'isNodeType': Type '${type}' does not exist in the GraphQL schema.`)
                    : (typeAST.type == 'TYPE' && typeAST.metadata && typeAST.metadata.name == 'node') ? true : false)
                .val())
        .val()

/**
 * If the schemaAST's metadata is of type 'edge', it extracts its body.
 * 
 * @param  {Object} metadata SchemaAST's metadata 
 * @return {String}          SchemaAST's metadata's body
 */
const getEdgeDesc = metadata => (!metadata || metadata.name != 'edge') ? null : metadata.body.replace(/(^\(|\)$)/g, '') 

/**
 * Remove potential alias in queries similor to 'users:persons'
 * @param  {String} query e.g. 'users:persons'
 * @return {String}       e.g. 'persons'
 */
const removeAlias = (query='') => query.split(':').slice(-1).join('') 

/**
 * [description]
 * 
 * @param  {Object} queryProp       Property object from the QueryAST
 * @param  {Object} parentTypeAST   Schema type object from the SchemaAST that is assumed to contain the queryProp
 * @param  {Array}  schemaAST       Entire SchemaAST
 * @return {Object}                 Query prop's AST enriched with all metadata from the schemaAST
 */
const addMetadataToProperty = (queryProp, parentTypeAST, schemaAST) => 
    chain(parentTypeAST.blockProps.find(x => x.details.name == removeAlias(queryProp.name)))
    .next(schemaProp => {
        if (schemaProp)
            return { 
                name: queryProp.name, 
                kind: queryProp.kind,
                type: schemaProp.details.result.name, 
                metadata: schemaProp.details.metadata,
                isNode: isNodeType(schemaProp.details.result.name, schemaAST),
                edge: getEdgeDesc(schemaProp.details.metadata), 
                args: queryProp.args,
                properties: queryProp.properties && queryProp.properties.length > 0
                    ?   chain(schemaProp.details.result.name)
                        .next(typename => (typename.match(/^\[(.*?)\]$/) || [null, typename])[1])
                        .next(typename => schemaAST.find(x => x.type == 'TYPE' && x.name == typename))
                        .next(parentTypeAST => parentTypeAST 
                            ? queryProp.properties.map(queryProp => addMetadataToProperty(queryProp, parentTypeAST, schemaAST))
                            : throwError(true, `Error in method 'addMetadataToProperty': Cannot find type '${schemaProp.details.result.name}' in the GraphQL Schema.`))
                        .val()
                    :   null
            }
        else
            return { 
                name: queryProp.name, 
                kind: queryProp.kind,
                type: null, 
                metadata: null,
                isNode: null,
                edge: null, 
                args: queryProp.args,
                properties: queryProp.properties,
                error: schemaProp ? null : `Error in method 'addMetadataToProperty': Query function '${queryProp.name}' is not defined in the GraphQL schema (specifically in the 'parentTypeAST' argument).`
            }
    })
    .val()

/**
 * Parses a string GraphQL query to an AST enriched with metadata from the GraphQL Schema AST.
 *  
 * @param  {String}  query          Raw string GraphQL query (e.g. query Hello($person: String, $animal: String) { ... })
 * @param  {Array}   schemaAST      Array of schema objects. Use 'graphql-s2s' npm package('getSchemaParts' method) to get that AST.
 * @return {Array}   output         Array represent all query's AST.
 * @return {String}  output.head    Head of the original query (e.g. Hello($person: String, $animal: String))
 * @return {String}  output.type    Query type (e.g. query || mutation || subscription)
 */
const addMetadataToAST = (operation, schemaAST, queryType='Query') => 
    chain(
        // If that object has already been processed, then get it.
        schemaAST[`get${queryType}`] || 
        // If this is the first time we access that object, then compute it and save it for later.
        chain(schemaAST[`get${queryType}`] = schemaAST.find(x => x.type == 'TYPE' && x.name == queryType)).next(() => schemaAST[`get${queryType}`]).val())
    .next(parentTypeAST => 
        chain(operation && operation.properties
            ? operation.properties.map(prop => addMetadataToProperty(prop, parentTypeAST, schemaAST))
            : [])
        .next(body => {
            operation.properties = body
            return operation
        })
        .val())
    .val()

const parseProperties = selectionSet => !selectionSet ? null : (selectionSet.selections || []).map(x => ({
    name: `${x.alias ? x.alias.value + ':' : ''}${x.name.value}`,
    args: parseArguments(x.arguments),
    properties: parseProperties(x.selectionSet),
    kind: x.kind
}))

const parseKeyValue = ({ kind, name, value }) => ({
    name: name ? name.value : null,
    value: !name && !value.kind ? { kind, value } : {
        kind: value.kind,
        value: 
            value.name ? value.name.value :
            value.fields ? value.fields.map(f => parseKeyValue(f)) :
            value.values ? value.values.map(v => parseKeyValue(v)) : value.value
    }
})

const parseArguments = astArgs => !astArgs || !astArgs.length 
    ? null 
    : astArgs.map(a => parseKeyValue(a))

const parseFragments = (fragments = []) => fragments.length == 0 ? null : fragments.map(fragment => ({
    name: (fragment.name || {}).value,
    type: ((fragment.typeCondition || {}).name || {}).value,
    properties: parseProperties(fragment.selectionSet)
}))

const _graphQlQueryTypes = { 'query': 'Query', 'mutation': 'Mutation', 'subscription': 'Subscription' }
/**
 * [description]
 * @param  {[type]}  query          [description]
 * @param  {[type]}  schemaAST      [description]
 * @param  {Boolean} options.defrag [description]
 * @return {[type]}                 [description]
 */
const getQueryAST = (query, operationName, schemaAST, options={}) => {
    const parsedQuery = (parse(query) || {}).definitions || []
    const ast = parsedQuery.find(x => x.kind == 'OperationDefinition' && (!operationName || x.name.value == operationName))
    if (!ast) {
        if (operationName)
            throw new Error(`Invalid Graphql query. Operation name '${operationName}' is not defined in the query.`)
        else
            throw new Error('Invalid Graphql query. No \'OperationDefinition\' defined in the query.')
    }
    const fragments = parsedQuery.filter(x => x.kind == 'FragmentDefinition')
    if (ast) {
        const operation = {
            type: ast.operation,
            name: ast.name ? ast.name.value : null,
            variables: ast.variableDefinitions 
                ? ast.variableDefinitions.map(({ variable:v, type:t }) => {
                    const nonNullType = t.kind == 'NonNullType'
                    const exclPoint = nonNullType ? '!' : ''
                    const typ = nonNullType ? t.type : t
                    return { 
                        name: v.name.value, 
                        type: typ.kind == 'ListType' ? `[${typ.type.name.value}]${exclPoint}` : `${typ.name.value}${exclPoint}` }
                    }) 
                : null,
            properties: parseProperties(ast.selectionSet), 
            fragments: parseFragments(fragments)
        }
        const postProcess = options.defrag ? o => addMetadataToAST(defrag(o), schemaAST, _graphQlQueryTypes[ast.operation]) : o => o
        let output = postProcess(addMetadataToAST(operation, schemaAST, _graphQlQueryTypes[ast.operation] ))
        Object.assign(output, { 
            filter: fn => filterQueryAST(output, fn), 
            some: fn => detectQueryAST(output, fn),
            propertyPaths: fn => getQueryASTPropertyPaths(output, fn)
        })
        return output
    }
    else
        return null
}

const stringifyOperation = (operation={}) => {
    const acc = []
    acc.push(operation.type || 'query')
    if (operation.name) 
        acc.push(operation.name)
    if (operation.variables && operation.variables.length > 0)
        acc.push(`(${operation.variables.map(v => `$${v.name}: ${v.type}`).join(', ')})`)

    return acc.join(' ')
}

const filterQueryAST = (operation={}, predicate, onlyReturnBody=false) => {
    if (operation.properties && predicate) {
        const filteredBody = operation.properties
            .filter(x => predicate(x))
            .map(x => x.properties && x.properties.length > 0 
                ? Object.assign({}, x, { properties: filterQueryAST(x, predicate, true) })
                : x)

        return onlyReturnBody ? filteredBody : Object.assign({}, operation, { properties: filteredBody })
    }
    else
        return onlyReturnBody ? null : operation
}

const detectQueryAST = (operation={}, predicate) => 
    operation.properties && 
    predicate && 
    (operation.properties.some(x => predicate(x)) || operation.properties.some(x => detectQueryAST(x, predicate)))

const getQueryASTPropertyPaths = (operation={}, predicate, parent='') => {
    const prefix = parent ? parent + '.' : parent
    if (operation.properties && predicate) 
        return operation.properties.reduce((acc, p) => {
            if (predicate(p))
                acc.push({ property: prefix + p.name, type: p.type })
            if (p.properties)
                acc.push(...getQueryASTPropertyPaths(p, predicate, prefix + p.name))
            return acc
        }, [])
    else
        return []
}

/**
 * Rebuild a string GraphQL query from the query AST
 * @param  {Object}  operation  Query AST 
 * @return {String}             String GraphQL query
 */
const buildQuery = (operation={}, skipOperationParsing=false) => 
    chain((operation.properties || []).map(a => buildSingleQuery(a)).join('\n'))
    .next(body => `${skipOperationParsing ? '' : stringifyOperation(operation)}{\n${body}\n}`)
    .next(op => operation.fragments && operation.fragments.length > 0
        ? `${op}\n${stringifyFragments(operation.fragments)}`
        : op)
    .val()

const stringifyFragments = (fragments=[]) => 
    fragments.map(f => `fragment ${f.name} on ${f.type} ${buildQuery(f, true)}`).join('\n')

const buildSingleQuery = AST => {
    if (AST && AST.name) {
        const fnName = AST.name
        const args = AST.args ? stringifyArgs(AST.args).trim() : ''
        const fields = AST.properties && AST.properties.length > 0 ? buildQuery(AST, true) : ''
        return AST.kind == 'FragmentSpread' 
            ? `...${fnName}` 
            : `${fnName}${args ? `(${args})` : ''}${fields}`
    }
    else
        return ''
}

const stringifyValue = ({kind, value}) => {
    if (Array.isArray(value))
        return kind == 'ListValue' ? `[${stringifyArgs(value)}]` : `{${stringifyArgs(value)}}`   
    else
        return  kind == 'Variable' ? `$${value}` :
            kind == 'StringValue' ? `"${value}"` : value
}

const stringifyArgs = (args=[]) => 
    `${args.map(arg => `${arg.name ? arg.name + ':' : '' }${stringifyValue(arg.value)}`).join(',')}`

let _defragCache = {}
const defrag = operation => {
    if (operation && operation.fragments && operation.fragments.length > 0) {
        // reset cache
        _defragCache = {}
        const properties = replaceFragmentsInProperties(operation.properties, operation.fragments)
        // reset cache
        _defragCache = {}
        return Object.assign({}, operation, { properties, fragments: null })
    }
    else
        return operation
}

const replaceFragmentsInProperty = (prop, fragments=[]) => {
    if (prop.kind == 'FragmentSpread') {
        const fragmentName = prop.name
        const fragment = fragments.find(f => f.name == fragmentName)
        if (!fragment) 
            throw new Error(`Invalid GraphQL query. Fragment '${fragmentName}' does not exist.`)

        if (!_defragCache[fragmentName]) 
            _defragCache[fragmentName] = replaceFragmentsInProperties(fragment.properties, fragments)

        return _defragCache[fragmentName]
    }
    else if (prop.properties && prop.properties.length > 0) {
        const properties = replaceFragmentsInProperties(prop.properties, fragments)
        return Object.assign({}, prop, { properties })
    } 
    else
        return prop
}

const replaceFragmentsInProperties = (properties, fragments=[]) => {
    if (properties && properties.length > 0) {
        const propertiesObj = properties.reduce((props, p) => {
            const _p = replaceFragmentsInProperty(p, fragments)
            if (Array.isArray(_p)) {
                _p.forEach(property => {
                    const existingProp = props[property.name]
                    // Save it if this property is new or if the existing property does not have a metadata property 
                    // WARNING: metadata === undefined is better than metadata == null as it really proves that metadata 
                    // has never been set.
                    if (!existingProp || existingProp.metadata === undefined)
                        props[property.name] = property
                })
            }
            else {
                const existingProp = props[_p.name]
                if (!existingProp || existingProp.metadata === undefined)
                    props[_p.name] = _p
            }
            return props
        }, {})

        let results = []
        for(let key in propertiesObj)
             results.push(propertiesObj[key])

        return results
    }
    else
        return null
}

module.exports = {
    chain,
    log,
    escapeGraphQlSchema,
    removeMultiSpaces,
    matchLeftNonGreedy,
    getQueryAST,
    buildQuery,
    time: {
        start: startTime,
        log: logTime
    }
}