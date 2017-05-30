/**
 * Copyright (c) 2017, Neap Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const assert = require('assert');
const { getSchemaParts, transpileSchema, extractGraphMetadata } = require('../index');

const compressString = s => s.replace(/[\n\r]+/g, '').replace(/[\t\r]+/g, '').replace(/ /g,'');

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
    it('Should add properties from the super type to the sub type', () => {
    	const output = transpileSchema(schema_input_1);
      const answer = compressString(output);
      const correct = compressString(schema_output_1);
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
    it('Should remove any metadata from the GraphQL schema so it can be compiled by Graphql.js', () => {
      const output = transpileSchema(schema_input_3);
      const answer = compressString(output);
      const correct = compressString(schema_output_3);
      assert.equal(answer,correct);
    })));

describe('index', () => 
  describe('#extractGraphMetadata: EXTRACT METADATA', () => 
    it('Should extract all metadata (i.e. data starting with \'@\') located on top of schema types of properties.', () => {
      const output = extractGraphMetadata(schema_input_3);
      assert.ok(output.metadata);
      assert.ok(output.metadata.length);
      assert.equal(output.metadata.length, 3);
      const meta1 = output.metadata[0];
      const meta2 = output.metadata[1];
      const meta3 = output.metadata[2];
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



