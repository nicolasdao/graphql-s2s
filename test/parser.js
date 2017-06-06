/**
 * Copyright (c) 2017, Neap Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const _ = require('lodash');
const { inspect } = require('util');
const assert = require('assert');
const { getSchemaParts, transpileSchema, extractGraphMetadata } = require('../index');

const compressString = s => s.replace(/[\n\r]+/g, '').replace(/[\t\r]+/g, '').replace(/ /g,'');

const schema_input_vndfis = `
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
const schema_output_vndfis = `
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


describe('index', () => 
  describe('#transpileSchema: BASICS', () => 
    it('Should not affect a standard schema after transpilation.', () => {
      const output = transpileSchema(schema_input_vndfis);
      const answer = compressString(output);
      const correct = compressString(schema_output_vndfis);
      assert.equal(answer,correct);
    })));

const schema_input_1 = `
type Post {
  id: ID! 
  name: String!
}

type PostUserRating inherits Post {
  rating: PostRating!
}
`
const schema_output_1 = `
type Post {
    id: ID!
    name: String!
}

type PostUserRating {
    id: ID!
    name: String!
    rating: PostRating!
}`


describe('index', () => 
  describe('#transpileSchema: INHERITANCE', () => 
    it('Should add properties from the super type to the sub type.', () => {
      const output = transpileSchema(schema_input_1);
      const answer = compressString(output);
      const correct = compressString(schema_output_1);
      assert.equal(answer,correct);
    })));

const schema_input_xdwe3d = `
type Person {
  firstname: String
  lastname: String
}

type User { #inherits Person {
  username: String!
  posts: [Post]
}
`
const schema_output_xdwe3d = `
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

describe('index', () => 
  describe('#transpileSchema: COMMENTED INHERITANCE', () => 
    it('Should not let a type inherits from a super type when the \'inherits\' keyword has been commented out on the same line (e.g. \'type User { #inherits Person {\').', () => {
      const output = transpileSchema(schema_input_xdwe3d);
      const answer = compressString(output);
      const correct = compressString(schema_output_xdwe3d);
      assert.equal(answer,correct);
    })));

const schema_input_2 = `
type Paged<T> {
  data: [T]
  cursor: ID
}

type User {
  posts: Paged<Post>
}
`
const schema_output_2 = `
type User {
  posts: PagedPost
}
type PagedPost {
  data: [Post]
  cursor: ID
}
`


describe('index', () => 
  describe('#transpileSchema: GENERIC TYPES', () => 
    it('Should create a new type for each instance of a generic type, as well as removing the original generic type definition.', () => {
      const output = transpileSchema(schema_input_2);
      const answer = compressString(output);
      const correct = compressString(schema_output_2);
      assert.equal(answer,correct);
    })));

const schema_input_3 = `
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
const schema_output_3 = `
type Brand {
  id: ID!
  name: String
  posts: [Post]
}

input User {
  posts: [Post]
}
`

describe('index', () => 
  describe('#transpileSchema: REMOVE METADATA', () => 
    it('Should remove any metadata from the GraphQL schema so it can be compiled by Graphql.js.', () => {
      const output = transpileSchema(schema_input_3);
      const answer = compressString(output);
      const correct = compressString(schema_output_3);
      assert.equal(answer,correct);
    })));

const schema_input_cdwbqjf24cden76532 = `
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
const schema_output_cdwbqjf24cden76532 = `
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

describe('index', () => 
  describe('#transpileSchema: COMPLEX COMMENTS WITH MARKDOWN CODE BLOCKS', () => 
    it('Should successfully transpile the schema even when there are complex markdown comments containing code blocks.', () => {
      const output = transpileSchema(schema_input_cdwbqjf24cden76532);
      const answer = compressString(output);
      const correct = compressString(schema_output_cdwbqjf24cden76532);
      assert.equal(answer,correct);
    })));

describe('index', () => 
  describe('#extractGraphMetadata: EXTRACT METADATA', () => 
    it('Should extract all metadata (i.e. data starting with \'@\') located on top of schema types of properties.', () => {
      const output = extractGraphMetadata(schema_input_3);
      //console.log(inspect(output));
      assert.ok(output);
      assert.ok(output.length);
      assert.equal(output.length, 3);
      const meta1 = output[0];
      const meta2 = output[1];
      const meta3 = output[2];
      assert.equal(meta1.name, 'node');
      assert.equal(meta2.name, 'edge');
      assert.equal(meta3.name, 'miracle');
      assert.equal(meta1.body, '');
      assert.equal(meta2.body, '(\'<-[ABOUT]-\')');
      assert.equal(meta3.body, '');
      assert.equal(meta1.schemaType, 'TYPE');
      assert.equal(meta2.schemaType, 'PROPERTY');
      assert.equal(meta3.schemaType, 'INPUT');
      assert.equal(meta1.schemaName, 'Brand');
      assert.equal(meta2.schemaName, 'posts: [Post]');
      assert.equal(meta3.schemaName, 'User');
      assert.equal(meta1.parent, null);
      assert.ok(meta2.parent);
      assert.equal(meta3.parent, null);
      assert.equal(meta2.parent.type, 'TYPE');
      assert.equal(meta2.parent.name, 'Brand');
      assert.ok(meta2.parent.metadata);
      assert.equal(meta2.parent.metadata.type, 'TYPE');
      assert.equal(meta2.parent.metadata.name, 'node');
    })));

const schema_input_aprck8 = `
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

describe('index', () => 
  describe('#getSchemaParts: BASICS', () => 
    it('Should extract all types and their properties including their respective comments.', () => {
      const schemaParts = getSchemaParts(schema_input_aprck8);
      //console.log(schemaParts);
      assert.ok(schemaParts, 'schemaParts should exist.');
      assert.equal(schemaParts.length, 2);

      const type1 = schemaParts[0];
      assert.equal(type1.type, 'TYPE');
      assert.equal(type1.name, 'Post');
      assert.equal(type1.genericType, null);
      assert.equal(type1.inherits, null);
      assert.equal(type1.implements, null);
      assert.equal(compressString(type1.comments), compressString('# This is some description of\n# what a Post object is.'));
      assert.ok(type1.blockProps, 'type1.blockProps should exist.');
      assert.equal(type1.blockProps.length, 2);
      const type1Prop1 = type1.blockProps[0];
      const type1Prop2 = type1.blockProps[1];
      assert.equal(!type1Prop1.comments, true);
      assert.ok(type1Prop1.details, 'type1Prop1.details should exist.');
      assert.equal(type1Prop1.details.name, 'id');
      assert.equal(type1Prop1.details.params, null);
      assert.ok(type1Prop1.details.result, 'type1Prop1.details.result should exist.');
      assert.equal(type1Prop1.details.result.originName, 'ID!');
      assert.equal(type1Prop1.details.result.isGen, false);
      assert.equal(type1Prop1.details.result.name, 'ID!');
      assert.equal(compressString(type1Prop2.comments), compressString('# A name is a property.'));
      assert.ok(type1Prop2.details, 'type1Prop2.details should exist.');
      assert.equal(type1Prop2.details.name, 'name');
      assert.equal(type1Prop2.details.params, null);
      assert.ok(type1Prop2.details.result, 'type1Prop2.details.result should exist.');
      assert.equal(type1Prop2.details.result.originName, 'String!');
      assert.equal(type1Prop2.details.result.isGen, false);
      assert.equal(type1Prop2.details.result.name, 'String!');

      const type2 = schemaParts[1];
      assert.equal(type2.type, 'INPUT');
      assert.equal(type2.name, 'PostUserRating');
      assert.equal(type2.genericType, null);
      assert.equal(type2.inherits, null);
      assert.equal(type2.implements, null);
      assert.equal(!type2.comments, true);
      assert.ok(type2.blockProps, 'type2.blockProps should exist.');
      assert.equal(type2.blockProps.length, 1);
      const type2Prop1 = type2.blockProps[0];
      assert.equal(compressString(type2Prop1.comments), compressString('# Rating indicates the rating a user gave\n# to a post.'));
      assert.ok(type2Prop1.details, 'type2Prop1.details should exist.');
      assert.equal(type2Prop1.details.name, 'rating');
      assert.equal(type2Prop1.details.params, null);
      assert.ok(type2Prop1.details.result, 'type2Prop1.details.result should exist.');
      assert.equal(type2Prop1.details.result.originName, 'PostRating!');
      assert.equal(type2Prop1.details.result.isGen, false);
      assert.equal(type2Prop1.details.result.name, 'PostRating!');
    })));

const schema_input_pxbdksb204h = `
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

describe('index', () => 
  describe('#getSchemaParts: GENERIC TYPES', () => 
    it('Should create new types for each instance of a generic type.', () => {
      const schemaParts = getSchemaParts(schema_input_pxbdksb204h);

      assert.ok(schemaParts);
      assert.equal(schemaParts.length, 4);
      const genObj = _(schemaParts).find(s => s.type == 'TYPE' && s.name == 'PagedPost');
      assert.ok(genObj, "The object 'PagedPost' that should have been auto-generated from Paged<Post> has not been created.");
    })));

const schema_input_dfewcsad356 = `
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

describe('index', () => 
  describe('#getSchemaParts: INHERITED METADATA', () => 
    it('Should add properties from the super type to the sub type.', () => {
      const schemaParts = getSchemaParts(schema_input_dfewcsad356);

      assert.ok(schemaParts);
      assert.equal(schemaParts.length, 3);
      // PostUserRating
      const schemaPart1 = schemaParts[0];
      const typeMeta1 = schemaPart1.metadata;
      assert.ok(typeMeta1);
      assert.equal(typeMeta1.name, 'supertype');
      assert.equal(typeMeta1.body, '(() => { return 1*2; })');
      assert.ok(schemaPart1.blockProps);
      assert.equal(schemaPart1.blockProps.length, 4);
      const typeMeta1Prop1 = schemaPart1.blockProps[0];
      assert.equal(typeMeta1Prop1.details.name, 'id');
      assert.ok(typeMeta1Prop1.details.metadata);
      assert.equal(!typeMeta1Prop1.details.metadata.body, true);
      assert.equal(typeMeta1Prop1.details.metadata.name, 'primaryKey');
      const typeMeta1Prop2 = schemaPart1.blockProps[1];
      assert.equal(typeMeta1Prop2.details.name, 'name');
      assert.ok(typeMeta1Prop2.details.metadata);
      assert.equal(!typeMeta1Prop2.details.metadata.body, true);
      assert.equal(typeMeta1Prop2.details.metadata.name, 'boris');
      const typeMeta1Prop3 = schemaPart1.blockProps[2];
      assert.equal(typeMeta1Prop3.details.name, 'rating');
      assert.ok(typeMeta1Prop3.details.metadata);
      assert.equal(typeMeta1Prop3.details.metadata.body, '((args) => { return \'hello world\'; })');
      assert.equal(typeMeta1Prop3.details.metadata.name, 'brendan');
      const typeMeta1Prop4 = schemaPart1.blockProps[3];
      assert.equal(typeMeta1Prop4.details.name, 'creationDate');
      assert.ok(!typeMeta1Prop4.details.metadata);

      // Node
      const schemaPart2 = schemaParts[1];
      const typeMeta2 = schemaPart2.metadata;
      assert.ok(typeMeta2);
      assert.equal(typeMeta2.name, 'node');
      assert.equal(!typeMeta2.body, true);
      assert.ok(schemaPart2.blockProps);
      assert.equal(schemaPart2.blockProps.length, 1);
      const typeMeta2Prop1 = schemaPart2.blockProps[0];
      assert.equal(typeMeta2Prop1.details.name, 'id');
      assert.ok(typeMeta2Prop1.details.metadata);
      assert.equal(!typeMeta2Prop1.details.metadata.body, true);
      assert.equal(typeMeta2Prop1.details.metadata.name, 'primaryKey');

      // Post
      const schemaPart3 = schemaParts[2];
      const typeMeta3 = schemaPart3.metadata;
      assert.ok(typeMeta3);
      assert.equal(typeMeta3.name, 'node');
      assert.equal(!typeMeta3.body, true);
      assert.ok(schemaPart3.blockProps);
      assert.equal(schemaPart3.blockProps.length, 2);
      const typeMeta3Prop1 = schemaPart3.blockProps[0];
      assert.equal(typeMeta3Prop1.details.name, 'id');
      assert.ok(typeMeta3Prop1.details.metadata);
      assert.equal(!typeMeta3Prop1.details.metadata.body, true);
      assert.equal(typeMeta3Prop1.details.metadata.name, 'primaryKey');
      const typeMeta3Prop2 = schemaPart3.blockProps[1];
      assert.equal(typeMeta3Prop2.details.name, 'name');
      assert.ok(typeMeta3Prop2.details.metadata);
      assert.equal(!typeMeta3Prop2.details.metadata.body, true);
      assert.equal(typeMeta3Prop2.details.metadata.name, 'boris');
    })));