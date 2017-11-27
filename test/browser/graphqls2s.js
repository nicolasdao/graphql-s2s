/**
 * Copyright (c) 2017, Neap Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
var browserctxt = typeof(chai) != 'undefined'
/*eslint-disable */
var assert = browserctxt ? chai.assert : null
/*eslint-enable */

var runtest = function(s2s, assert) {
  var compressString = function(s) { return s.replace(/[\n\r]+/g, '').replace(/[\t\r]+/g, '').replace(/ /g,'') }
  var getSchemaAST = s2s.getSchemaAST
  var transpileSchema = s2s.transpileSchema
  var extractGraphMetadata = s2s.extractGraphMetadata
  var getGenericAlias = s2s.getGenericAlias

  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#getGenericAlias', () => 
      it('Should .', () => {
        /*eslint-enable */
        var func = '(T => T + "s")'
        var genericType = 'Paged<Product>'
        var getAlias = getGenericAlias(func)
        var alias = getAlias(genericType)
        assert.equal(alias,'Products')

        var getAlias_2 = getGenericAlias()
        var alias_2 = getAlias_2(genericType)
        assert.equal(alias_2,'PagedProduct')

        var func_3 = '((T,U) => T + "sPer" + U)'
        var genericType_3 = 'Paged<Product, User>'
        var getAlias_3 = getGenericAlias(func_3)
        var alias_3 = getAlias_3(genericType_3)
        assert.equal(alias_3,'ProductsPerUser')

        var genericType_4 = 'Paged<Product, User>'
        var getAlias_4 = getGenericAlias()
        var alias_4 = getAlias_4(genericType_4)
        assert.equal(alias_4,'PagedProductUser')
      })))

  var schema_input_vndfis = `
  # This is some description of 
  # what a Post object is.
  type Post {
    id: ID! 
    # A name is a property.
    name: String!
  }

  type PostUserRating {
    # Rating indicates the rating a user gave 
    # to a post.
    rating: PostRating!
  }`

  var schema_output_vndfis = `
  # This is some description of 
  # what a Post object is.
  type Post {
    id: ID! 
    # A name is a property.
    name: String!
  }

  type PostUserRating {
    # Rating indicates the rating a user gave 
    # to a post.
    rating: PostRating!
  }`

  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#transpileSchema: BASICS', () => 
      it('Should not affect a standard schema after transpilation.', () => {
        var output = transpileSchema(schema_input_vndfis)
        var answer = compressString(output)
        var correct = compressString(schema_output_vndfis)
        assert.equal(answer,correct)
      })))

  var schema_input_vnwdvs = `
  type Query {
    bars: [Bar]!
  }
  type Bar {
    id: ID
  }
  type Foo {
    id: String!
  }
  extend    type Query {
    foos: [Foo]!
  }`
  
  var schema_output_vnwdvs = `
  type Query {
    bars: [Bar]!
  }
  type Bar {
    id: ID
  }
  type Foo {
    id: String!
  }
  extend type Query {
    foos: [Foo]!
  }`

  /*eslint-disable */
  describe('graphqls2s', () => 
    // This was added on the 28th of Oct following a reported bug that the 'extend' keyword was erased after the transpiled operation.
    // Ref: 
    // - Name: The keyword "extend" is lost #1
    // - Raised by: kaihaase-wd 
    describe('#transpileSchema: SUPPORT THE EXTEND KEYWORD', () => 
      it(`Should support extending schema using the 'extend' keyword.`, () => {
        var output = transpileSchema(schema_input_vnwdvs)
        var answer = compressString(output)
        var correct = compressString(schema_output_vnwdvs)
        assert.equal(answer,correct)
      })))

  var schema_input_1 = `
  type Post {
    id: ID! 
    name: String!
  }

  type PostUserRating inherits Post {
    rating: PostRating!
  }
  `
  var schema_output_1 = `
  type Post {
      id: ID!
      name: String!
  }

  type PostUserRating {
      id: ID!
      name: String!
      rating: PostRating!
  }`

  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#transpileSchema: INHERITANCE', () => 
      it('Should add properties from the super type to the sub type.', () => {
        /*eslint-enable */
        var output = transpileSchema(schema_input_1)
        var answer = compressString(output)
        var correct = compressString(schema_output_1)
        assert.equal(answer,correct)
      })))

  var schema_input_xdwe3d = `
  type Person {
    firstname: String
    lastname: String
  }

  type User { #inherits Person {
    username: String!
    posts: [Post]
  }
  `
  var schema_output_xdwe3d = `
  type Person {
    firstname: String
    lastname: String
  }

  type User {
      #inherits Person {
      username: String!
      posts: [Post]
  }
  `
  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#transpileSchema: COMMENTED INHERITANCE', () => 
      it('Should not let a type inherits from a super type when the \'inherits\' keyword has been commented out on the same line (e.g. \'type User { #inherits Person {\').', () => {
        /*eslint-enable */
        var output = transpileSchema(schema_input_xdwe3d)
        var answer = compressString(output)
        var correct = compressString(schema_output_xdwe3d)
        assert.equal(answer,correct)
      })))

  var schema_input_2 = `
  type Paged<T> {
    data: [T]
    cursor: ID
  }

  type User {
    posts: Paged<Post>
  }
  `
  var schema_output_2 = `
  type User {
    posts: PagedPost
  }
  type PagedPost {
    data: [Post]
    cursor: ID
  }
  `
  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#transpileSchema: GENERIC TYPES', () => 
      it('Should create a new type for each instance of a generic type, as well as removing the original generic type definition.', () => {
        /*eslint-enable */
        var output = transpileSchema(schema_input_2)
        var answer = compressString(output)
        var correct = compressString(schema_output_2)
        assert.equal(answer,correct)
      })))

  var schema_input_3 = `
  @node
  type Brand {
    id: ID!
    name: String
    @edge('<-[ABOUT]-')
    posts: [Post]
  }

  @miracle
  input User {
    posts: [Post]
  }
  `
  var schema_output_3 = `
  type Brand {
    id: ID!
    name: String
    posts: [Post]
  }

  input User {
    posts: [Post]
  }
  `
  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#transpileSchema: REMOVE METADATA', () => 
      it('Should remove any metadata from the GraphQL schema so it can be compiled by Graphql.js.', () => {
        /*eslint-enable */
        var output = transpileSchema(schema_input_3)
        var answer = compressString(output)
        var correct = compressString(schema_output_3)
        assert.equal(answer,correct)
      })))

  var schema_input_34234Hsw8 = `
  type Brand {
    id: ID!
    name: String
    posts: Page<Post>
  }

  @alias((T) => T + 's')
  type Page<T> {
    data: [T]
  }
  `
  var schema_output_34234Hsw8 = `
  type Brand {
    id: ID!
    name: String
    posts: Posts
  }

  type Posts {
    data: [Post]
  }
  `
  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#transpileSchema: ALIASES SUPPORT FOR GENERIC TYPES WITH THE @alias METADATA', () => 
      it('Should allow to define custom names in generic types', () => {
        /*eslint-enable */
        var output = transpileSchema(schema_input_34234Hsw8)
        var answer = compressString(output)
        var correct = compressString(schema_output_34234Hsw8)
        assert.equal(answer,correct)
      })))

  var schema_input_cdwbqjf24cden76532 = `
  # ### Page - Pagination Metadata
  # The Page object represents metadata about the size of the dataset returned. It helps with pagination.
  # Example:
  #
  # \`\`\`js
  # getData(first: 100, skip: 200)
  # \`\`\`
  # Skips the first 200 items, and gets the next 100.
  #
  # To help represent this query using pages, GraphHub adds properties like _current_ and _total_. In the
  # example above, the returned Page object could be:
  #
  # \`\`\`js
  # {
  # first: 100,
  # skip: 200,
  # current: 3,
  # total: {
  #   size: 1000,
  #   pages: 10
  # }
  # }
  # \`\`\`
  type Page {
    # The pagination parameter sent in the query
    first: Int!

    # The pagination parameter sent in the query
    skip: Int!

    # The convertion from 'first' and 'after' in terms of the current page
    # (e.g. { first: 100, after: 200 } -> current: 3).
      current: Int!

      # Inspect the total size of your dataset ignoring pagination.
      total: DatasetSize
  }

  # ### DatasetSize - Pagination Metadata
  # Used in the Page object to describe the total number of pages available.
  type DatasetSize {
    size: Int!
    pages: Int!
  }
  `
  var schema_output_cdwbqjf24cden76532 = `
  # ### Page - Pagination Metadata
  # The Page object represents metadata about the size of the dataset returned. It helps with pagination.
  # Example:
  #
  # \`\`\`js
  # getData(first: 100, skip: 200)
  # \`\`\`
  # Skips the first 200 items, and gets the next 100.
  #
  # To help represent this query using pages, GraphHub adds properties like _current_ and _total_. In the
  # example above, the returned Page object could be:
  #
  # \`\`\`js
  # {
  # first: 100,
  # skip: 200,
  # current: 3,
  # total: {
  #   size: 1000,
  #   pages: 10
  # }
  # }
  # \`\`\`
  type Page {
      # The pagination parameter sent in the query
      first: Int!
      # The pagination parameter sent in the query
      skip: Int!
      # The convertion from 'first' and 'after' in terms of the current page
      # (e.g. { first: 100, after: 200 } -> current: 3).
      current: Int!
      # Inspect the total size of your dataset ignoring pagination.
      total: DatasetSize
  }

  # ### DatasetSize - Pagination Metadata
  # Used in the Page object to describe the total number of pages available.
  type DatasetSize {
      size: Int!
      pages: Int!
  }`

  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#transpileSchema: COMPLEX COMMENTS WITH MARKDOWN CODE BLOCKS', () => 
      it('Should successfully transpile the schema even when there are complex markdown comments containing code blocks.', () => {
        /*eslint-enable */
        var output = transpileSchema(schema_input_cdwbqjf24cden76532)
        var answer = compressString(output)
        var correct = compressString(schema_output_cdwbqjf24cden76532)
        assert.equal(answer,correct)
      })))

  var schema_input_fdwkhj42 = `scalar Date
scalar Like

  # This is some description of 
  # what a Post object is plus an attemp to fool the scalar type.
  type Post {
    id: ID! 
    # A name is a property.
    name: String!
    creationDate: Date
    likeRate: Like
  }

  scalar Strength

  type Test { id: ID }

  type PostUserRating {
    # Rating indicates the rating a user gave 
    # to a post. Fooling test: type Test { id: ID }
    rating: Strength!
  }`

  var schema_output_fdwkhj42 = `
  # This is some description of 
  # what a Post object is plus an attemp to fool the scalar type.
  type Post {
    id: ID! 
    # A name is a property.
    name: String!
    creationDate: Date
    likeRate: Like
  }

  type Test { id: ID }

  type PostUserRating {
    # Rating indicates the rating a user gave 
    # to a post. Fooling test: type Test { id: ID }
    rating: Strength!
  }


  scalar Date
  scalar Like
  scalar Strength`

  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#transpileSchema: SUPPORT FOR SCALAR', () => 
      it('Should support custom scalar types.', () => {
        var output = transpileSchema(schema_input_fdwkhj42)
        var answer = compressString(output)
        var correct = compressString(schema_output_fdwkhj42)
        assert.equal(answer,correct)
      })))

  var schema_input_fdwfcds95d = `scalar Date
scalar Like

  union Product = Bicycle | Racket

  # This is some description of 
  # what a Post object is plus an attemp to fool the scalar type.
  type Post {
    id: ID! 
    # A name is a property.
    name: String!
    creationDate: Date
    likeRate: Like
  }

  scalar Strength

  type Test { id: ID }

  type PostUserRating {
    # Rating indicates the rating a user gave 
    # to a post. Fooling test: type Test { id: ID }
    rating: Strength!
  }`

  var schema_output_fdwfcds95d = `
  # This is some description of 
  # what a Post object is plus an attemp to fool the scalar type.
  type Post {
    id: ID! 
    # A name is a property.
    name: String!
    creationDate: Date
    likeRate: Like
  }

  type Test { id: ID }

  type PostUserRating {
    # Rating indicates the rating a user gave 
    # to a post. Fooling test: type Test { id: ID }
    rating: Strength!
  }

  union Product = Bicycle | Racket

  scalar Date
  scalar Like
  scalar Strength`

  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#transpileSchema: SUPPORT FOR UNION', () => 
      it('Should support union types.', () => {
        var output = transpileSchema(schema_input_fdwfcds95d)
        console.log(output)
        var answer = compressString(output)
        var correct = compressString(schema_output_fdwfcds95d)
        assert.equal(answer,correct)
      })))

  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#extractGraphMetadata: EXTRACT METADATA', () => 
      it('Should extract all metadata (i.e. data starting with \'@\') located on top of schema types of properties.', () => {
        /*eslint-enable */
        var output = extractGraphMetadata(schema_input_3)
        //console.log(inspect(output));
        assert.isOk(output)
        assert.isOk(output.length)
        assert.equal(output.length, 3)
        var meta1 = output[0]
        var meta2 = output[1]
        var meta3 = output[2]
        assert.equal(meta1.name, 'node')
        assert.equal(meta2.name, 'edge')
        assert.equal(meta3.name, 'miracle')
        assert.equal(meta1.body, '')
        assert.equal(meta2.body, '(\'<-[ABOUT]-\')')
        assert.equal(meta3.body, '')
        assert.equal(meta1.schemaType, 'TYPE')
        assert.equal(meta2.schemaType, 'PROPERTY')
        assert.equal(meta3.schemaType, 'INPUT')
        assert.equal(meta1.schemaName, 'Brand')
        assert.equal(meta2.schemaName, 'posts: [Post]')
        assert.equal(meta3.schemaName, 'User')
        assert.equal(meta1.parent, null)
        assert.isOk(meta2.parent)
        assert.equal(meta3.parent, null)
        assert.equal(meta2.parent.type, 'TYPE')
        assert.equal(meta2.parent.name, 'Brand')
        assert.isOk(meta2.parent.metadata)
        assert.equal(meta2.parent.metadata.type, 'TYPE')
        assert.equal(meta2.parent.metadata.name, 'node')
      })))

  var schema_input_aprck8 = `
  # This is some description of 
  # what a Post object is.
  type Post {
    id: ID! 
    # A name is a property.
    name: String!
  }

  input PostUserRating {
    # Rating indicates the rating a user gave
    # to a post.
    rating: PostRating!
  }
  `
  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#getSchemaAST: BASICS', () => 
      it('Should extract all types and their properties including their respective comments.', () => {
        /*eslint-enable */
        var schemaParts = getSchemaAST(schema_input_aprck8)
        //console.log(schemaParts);
        assert.isOk(schemaParts, 'schemaParts should exist.')
        assert.equal(schemaParts.length, 2)

        var type1 = schemaParts[0]
        assert.equal(type1.type, 'TYPE')
        assert.equal(type1.name, 'Post')
        assert.equal(type1.genericType, null)
        assert.equal(type1.inherits, null)
        assert.equal(type1.implements, null)
        assert.equal(compressString(type1.comments), compressString('# This is some description of\n# what a Post object is.'))
        assert.isOk(type1.blockProps, 'type1.blockProps should exist.')
        assert.equal(type1.blockProps.length, 2)
        var type1Prop1 = type1.blockProps[0]
        var type1Prop2 = type1.blockProps[1]
        assert.equal(!type1Prop1.comments, true)
        assert.isOk(type1Prop1.details, 'type1Prop1.details should exist.')
        assert.equal(type1Prop1.details.name, 'id')
        assert.equal(type1Prop1.details.params, null)
        assert.isOk(type1Prop1.details.result, 'type1Prop1.details.result should exist.')
        assert.equal(type1Prop1.details.result.originName, 'ID!')
        assert.equal(type1Prop1.details.result.isGen, false)
        assert.equal(type1Prop1.details.result.name, 'ID!')
        assert.equal(compressString(type1Prop2.comments), compressString('# A name is a property.'))
        assert.isOk(type1Prop2.details, 'type1Prop2.details should exist.')
        assert.equal(type1Prop2.details.name, 'name')
        assert.equal(type1Prop2.details.params, null)
        assert.isOk(type1Prop2.details.result, 'type1Prop2.details.result should exist.')
        assert.equal(type1Prop2.details.result.originName, 'String!')
        assert.equal(type1Prop2.details.result.isGen, false)
        assert.equal(type1Prop2.details.result.name, 'String!')

        var type2 = schemaParts[1]
        assert.equal(type2.type, 'INPUT')
        assert.equal(type2.name, 'PostUserRating')
        assert.equal(type2.genericType, null)
        assert.equal(type2.inherits, null)
        assert.equal(type2.implements, null)
        assert.equal(!type2.comments, true)
        assert.isOk(type2.blockProps, 'type2.blockProps should exist.')
        assert.equal(type2.blockProps.length, 1)
        var type2Prop1 = type2.blockProps[0]
        assert.equal(compressString(type2Prop1.comments), compressString('# Rating indicates the rating a user gave\n# to a post.'))
        assert.isOk(type2Prop1.details, 'type2Prop1.details should exist.')
        assert.equal(type2Prop1.details.name, 'rating')
        assert.equal(type2Prop1.details.params, null)
        assert.isOk(type2Prop1.details.result, 'type2Prop1.details.result should exist.')
        assert.equal(type2Prop1.details.result.originName, 'PostRating!')
        assert.equal(type2Prop1.details.result.isGen, false)
        assert.equal(type2Prop1.details.result.name, 'PostRating!')
      })))

  var schema_input_pxbdksb204h = `
  type Paged<T> {
    data: [T]
    cursor: ID
  }
  type Post {
    name
  }
  type User {
    username: String!
    posts: Paged<Post>
  } 
  `
  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#getSchemaAST: GENERIC TYPES', () => 
      it('Should create new types for each instance of a generic type.', () => {
        /*eslint-enable */
        var schemaParts = getSchemaAST(schema_input_pxbdksb204h)
        assert.isOk(schemaParts)
        assert.equal(schemaParts.length, 4)
        var genObj = (schemaParts || []).filter(s => s.type == 'TYPE' && s.name == 'PagedPost')[0]
        assert.isOk(genObj, 'The object \'PagedPost\' that should have been auto-generated from Paged<Post> has not been created.')
      })))

  var schema_input_dfewcsad356 = `
  @supertype(() => { return 1*2; })
  type PostUserRating inherits Post {
    @brendan((args) => { return 'hello world'; })
    rating: PostRating!
    creationDate: String
  }

  @node
  type Node {
    @primaryKey
    id: ID!
  }

  type Post inherits Node {
    @boris 
    name: String!
  }
  `
  /*eslint-disable */
  describe('graphqls2s', () => 
    describe('#getSchemaAST: INHERITED METADATA', () => 
      it('Should add properties from the super type to the sub type.', () => {
        /*eslint-enable */
        var schemaParts = getSchemaAST(schema_input_dfewcsad356)

        assert.isOk(schemaParts)
        assert.equal(schemaParts.length, 3)
        // PostUserRating
        var schemaPart1 = schemaParts[0]
        var typeMeta1 = schemaPart1.metadata
        assert.isOk(typeMeta1)
        assert.equal(typeMeta1.name, 'supertype')
        assert.equal(typeMeta1.body, '(() => { return 1*2; })')
        assert.isOk(schemaPart1.blockProps)
        assert.equal(schemaPart1.blockProps.length, 4)
        var typeMeta1Prop1 = schemaPart1.blockProps[0]
        assert.equal(typeMeta1Prop1.details.name, 'id')
        assert.isOk(typeMeta1Prop1.details.metadata)
        assert.equal(!typeMeta1Prop1.details.metadata.body, true)
        assert.equal(typeMeta1Prop1.details.metadata.name, 'primaryKey')
        var typeMeta1Prop2 = schemaPart1.blockProps[1]
        assert.equal(typeMeta1Prop2.details.name, 'name')
        assert.isOk(typeMeta1Prop2.details.metadata)
        assert.equal(!typeMeta1Prop2.details.metadata.body, true)
        assert.equal(typeMeta1Prop2.details.metadata.name, 'boris')
        var typeMeta1Prop3 = schemaPart1.blockProps[2]
        assert.equal(typeMeta1Prop3.details.name, 'rating')
        assert.isOk(typeMeta1Prop3.details.metadata)
        assert.equal(typeMeta1Prop3.details.metadata.body, '((args) => { return \'hello world\'; })')
        assert.equal(typeMeta1Prop3.details.metadata.name, 'brendan')
        var typeMeta1Prop4 = schemaPart1.blockProps[3]
        assert.equal(typeMeta1Prop4.details.name, 'creationDate')
        assert.isOk(!typeMeta1Prop4.details.metadata)

        // Node
        var schemaPart2 = schemaParts[1]
        var typeMeta2 = schemaPart2.metadata
        assert.isOk(typeMeta2)
        assert.equal(typeMeta2.name, 'node')
        assert.equal(!typeMeta2.body, true)
        assert.isOk(schemaPart2.blockProps)
        assert.equal(schemaPart2.blockProps.length, 1)
        var typeMeta2Prop1 = schemaPart2.blockProps[0]
        assert.equal(typeMeta2Prop1.details.name, 'id')
        assert.isOk(typeMeta2Prop1.details.metadata)
        assert.equal(!typeMeta2Prop1.details.metadata.body, true)
        assert.equal(typeMeta2Prop1.details.metadata.name, 'primaryKey')

        // Post
        var schemaPart3 = schemaParts[2]
        var typeMeta3 = schemaPart3.metadata
        assert.isOk(typeMeta3)
        assert.equal(typeMeta3.name, 'node')
        assert.equal(!typeMeta3.body, true)
        assert.isOk(schemaPart3.blockProps)
        assert.equal(schemaPart3.blockProps.length, 2)
        var typeMeta3Prop1 = schemaPart3.blockProps[0]
        assert.equal(typeMeta3Prop1.details.name, 'id')
        assert.isOk(typeMeta3Prop1.details.metadata)
        assert.equal(!typeMeta3Prop1.details.metadata.body, true)
        assert.equal(typeMeta3Prop1.details.metadata.name, 'primaryKey')
        var typeMeta3Prop2 = schemaPart3.blockProps[1]
        assert.equal(typeMeta3Prop2.details.name, 'name')
        assert.isOk(typeMeta3Prop2.details.metadata)
        assert.equal(!typeMeta3Prop2.details.metadata.body, true)
        assert.equal(typeMeta3Prop2.details.metadata.name, 'boris')
      })))
}

if (browserctxt) runtest(graphqls2s, assert)

if (typeof(module) != 'undefined')
  module.exports = {
    runtest
  }
