<a href="https://neap.co" target="_blank"><img src="https://neap.co/img/neap_logo_built_with_love.png" alt="Neap Pty Ltd logo" title="Neap" height="113" width="240" style="float: right" align="right" /></a>


# GraghQL Schema-2-Schema Transpiler
[![NPM][1]][2] [![Tests][3]][4]

[1]: https://img.shields.io/npm/v/graphql-s2s.svg?style=flat
[2]: https://www.npmjs.com/package/graphql-s2s
[3]: https://travis-ci.org/nicolasdao/graphql-s2s.svg?branch=master
[4]: https://travis-ci.org/nicolasdao/graphql-s2s

# Table Of Contents
> * [What It Does](#what-it-does)
> * [Install](#install)
> * [How To Use It](#how-to-use-it)
> * [Examples](#examples)
> * [Contribute](#contribute)

# What It Does
GraphQL S2S enriches the standard GraphQL Schema string used by both [graphql.js](https://github.com/graphql/graphql-js) and the [Apollo Server](https://github.com/apollographql/graphql-tools). The enriched schema supports:
* [**Type Inheritance**](#type-inheritance)
* [**Generic Types**](#generic-types)
* [**Metadata Decoration**](#metadata-decoration)

# Install
### node
```js
npm install 'graphql-s2s' --save
```
### browser
```html
<script src="https://neapjs.firebaseapp.com/graphqls2s/0.3.1/graphqls2s.min.js"></script>
```
The API will be accessible through the __*graphqls2s*__ object.

It is also possible to embed it after installing the _graphql-s2s_ npm package:
```html
<script src="./node_modules/graphql-s2s/lib/graphqls2s.min.js"></script>
```

# How To Use It
```js
const { transpileSchema } = require('graphql-s2s').graphqls2s
const { makeExecutableSchema } = require('graphql-tools')

const schema = `
type Node {
	id: ID!
}

type Person inherits Node {
	firstname: String
	lastname: String
}

type Student inherits Person {
	nickname: String
}

type Query {
  students: [Student]
}
`

const resolver = {
        Query: {
            students(root, args, context) {
            	// replace this dummy code with your own logic to extract students.
                return [{ id: 1, firstname: "Carry", lastname: "Connor", nickname: "Cannie" }]
            }
        }
    };

const executableSchema = makeExecutableSchema({
  typeDefs: [transpileSchema(schema)],
  resolvers: resolver
})
```

[**Type Inheritance**](#type-inheritance)
```js
const schema = `
type Node {
	id: ID!
}

# Inheriting from the 'Node' type
type Person inherits Node {
	firstname: String
	lastname: String
}

# Inheriting from the 'Person' type
type Student inherits Person {
	nickname: String
}
`
```
[**Generic Types**](#generic-types)
```js
const schema = `
# Defining a generic type
type Paged<T> {
	data: [T]
	cursor: ID
}

type Question {
	name: String!
	text: String!
}

# Using the generic type
type Student {
	name: String
	questions: Paged<Question>
}

# Using the generic type
type Teacher {
	name: String
	students: Paged<Student>
}
`
```
[**Metadata Decoration**](#metadata-decoration)
```js
const schema = `
# Defining a custom 'node' metadata attribute
@node
type Node {
	id: ID!
}

type Student inherits Node {
	name: String

	# Defining another custom 'edge' metadata, and supporting a generic type
	@edge(some other metadata using whatever syntax I want)
	questions: [String]
}
`
```

The enriched schema provides a richer and more compact notation. The transpiler converts the enriched schema into the standard expected by [graphql.js](https://github.com/graphql/graphql-js) (using the _buildSchema_ method) as well as the [Apollo Server](https://github.com/apollographql/graphql-tools). For more details on how to extract those extra information from the string schema, use the method _getSchemaAST_ (example in section [_Metadata Decoration_](#metadata-decoration)). 

_Metadata_ can be added to decorate the schema types and properties. Add whatever you want as long as it starts with _@_ and start hacking your schema. The original intent of that feature was to decorate the schema with metadata _@node_ and _@edge_ so we could add metadata about the nature of the relations between types.

# Examples
_WARNING: the following examples will be based on '[graphql-tools](https://github.com/apollographql/graphql-tools)' from the Apollo team, but the string schema could also be used with the 'buildSchema' method from graphql.js_

### Type Inheritance
_NOTE: The examples below only use 'type', but it would also work on 'input'_

__*Before graphql-s2s*__
```js
const schema = `
type Teacher {
	id: ID!
	creationDate: String

	firstname: String!
	middlename: String
	lastname: String!
	age: Int!
	gender: String 

	title: String!
}

type Student {
	id: ID!
	creationDate: String

	firstname: String!
	middlename: String
	lastname: String!
	age: Int!
	gender: String 

	nickname: String!
}`

```
__*After graphql-s2s*__
```js
const schema = `
type Node {
	id: ID!
	creationDate: String
}

type Person inherits Node {
	firstname: String!
	middlename: String
	lastname: String!
	age: Int!
	gender: String 
}

type Teacher inherits Person {
	title: String!
}

type Student inherits Person {
	nickname: String!
}`

```

__*Full code example*__

```js
const { transpileSchema } = require('graphql-s2s').graphqls2s
const { makeExecutableSchema } = require('graphql-tools')
const { students, teachers } = require('./dummydata.json')

const schema = `
type Node {
	id: ID!
	creationDate: String
}

type Person inherits Node {
	firstname: String!
	middlename: String
	lastname: String!
	age: Int!
	gender: String 
}

type Teacher inherits Person {
	title: String!
}

type Student inherits Person {
	nickname: String!
	questions: [Question]
}

type Question inherits Node {
	name: String!
	text: String!
}

type Query {
  # ### GET all users
  #
  students: [Student]

  # ### GET all teachers
  #
  teachers: [Teacher]
}
`

const resolver = {
        Query: {
            students(root, args, context) {
                return Promise.resolve(students)
            },

            teachers(root, args, context) {
                return Promise.resolve(teachers)
            }
        }
    }

const executableSchema = makeExecutableSchema({
  typeDefs: [transpileSchema(schema)],
  resolvers: resolver
})
```

### Generic Types
_NOTE: The examples below only use 'type', but it would also work on 'input'_

__*Before graphql-s2s*__
```js
const schema = `
type Teacher {
	id: ID!
	creationDate: String
	firstname: String!
	middlename: String
	lastname: String!
	age: Int!
	gender: String 
	title: String!
}

type Student {
	id: ID!
	creationDate: String
	firstname: String!
	middlename: String
	lastname: String!
	age: Int!
	gender: String 
	nickname: String!
	questions: Questions
}

type Question {
	id: ID!
	creationDate: String
	name: String!
	text: String!
}

type Teachers {
	data: [Teacher]
	cursor: ID
}

type Students {
	data: [Student]
	cursor: ID
}

type Questions {
	data: [Question]
	cursor: ID
}

type Query {
  # ### GET all users
  #
  students: Students

  # ### GET all teachers
  #
  teachers: Teachers
}
`

```
__*After graphql-s2s*__
```js
const schema = `
type Paged<T> {
	data: [T]
	cursor: ID
}

type Node {
	id: ID!
	creationDate: String
}

type Person inherits Node {
	firstname: String!
	middlename: String
	lastname: String!
	age: Int!
	gender: String 
}

type Teacher inherits Person {
	title: String!
}

type Student inherits Person {
	nickname: String!
	questions: Paged<Question>
}

type Question inherits Node {
	name: String!
	text: String!
}

type Query {
  # ### GET all users
  #
  students: Paged<Student>

  # ### GET all teachers
  #
  teachers: Paged<Teacher>
}
`
```
This is very similar to C# or Java generic classes. What the transpiler will do is to simply recreate 3 types (one for Paged\<Question\>, Paged\<Student\> and Paged\<Teacher\>). If we take the Paged\<Question\> example, the transpiled type will be:
```js
type PagedQuestion {
	data: [Question]
	cursor: ID
}
```

__*Full code example*__

```js
const { transpileSchema } = require('graphql-s2s').graphqls2s
const { makeExecutableSchema } = require('graphql-tools')
const { students, teachers } = require('./dummydata.json')

const schema = `
type Paged<T> {
	data: [T]
	cursor: ID
}

type Node {
	id: ID!
	creationDate: String
}

type Person inherits Node {
	firstname: String!
	middlename: String
	lastname: String!
	age: Int!
	gender: String 
}

type Teacher inherits Person {
	title: String!
}

type Student inherits Person {
	nickname: String!
	questions: Paged<Question>
}

type Question inherits Node {
	name: String!
	text: String!
}

type Query {
  # ### GET all users
  #
  students: Paged<Student>

  # ### GET all teachers
  #
  teachers: Paged<Teacher>
}
`

const resolver = {
        Query: {
            students(root, args, context) {
                return Promise.resolve({ data: students.map(s => ({ __proto__:s, questions: { data: s.questions, cursor: null }})), cursor: null })
            },

            teachers(root, args, context) {
                return Promise.resolve({ data: teachers, cursor: null });
            }
        }
    }

const executableSchema = makeExecutableSchema({
  typeDefs: [transpileSchema(schema)],
  resolvers: resolver
})
```

### Metadata Decoration
Define your own custom metadata and decorate your GraphQL schema with new types of data. Let's imagine we want to explicitely add metadata about the type of relations between nodes, we could write something like this:
```js
const { getSchemaAST } = require('graphql-s2s').graphqls2s
const schema = `
@node
type User {
	@edge('<-[CREATEDBY]-')
	posts: [Post]
}
`

const schemaObjects = getSchemaAST(schema);

// -> schemaObjects
//	{ 
//		"type": "TYPE", 
//		"name": "User", 
//		"metadata": { 
//			"name": "node", 
//			"body": "", 
//			"schemaType": "TYPE", 
//			"schemaName": "User", "parent": null 
//		}, 
//		"genericType": null, 
//		"blockProps": [{ 
//			"comments": "", 
//			"details": { 
//				"name": "posts", 
//				"metadata": { 
//					"name": "edge", 
//					"body": "(\'<-[CREATEDBY]-\')", 
//					"schemaType": "PROPERTY", 
//					"schemaName": "posts: [Post]", 
//					"parent": { 
//						"type": "TYPE", 
//						"name": "User", 
//						"metadata": { 
//							"type": "TYPE", 
//							"name": "node" 
//						} 
//					} 
//				}, 
//				"params": null, 
//				"result": { 
//					"originName": "[Post]", 
//					"isGen": false, 
//					"name": "[Post]" 
//				} 
//			}, 
//			"value": "posts: [Post]" 
//		}], 
//		"inherits": null, 
//		"implements": null 
//	}
```
# Contribute
This project is built using Javascript ES6. Each version is also transpiled to ES5 using Babel through Webpack 2, so this project can run in the browser. In order to write unit test only once instead of duplicating it for each version of Javascript, the all unit tests have been written using Javascript ES5 in mocha. That means that if you want to test the project after some changes, you will need to first transpile the project to ES5. This can be done simply by running the following command:

```
npm run dev
npm test
```

If you want to test the code without transpiling it, I've added a variant:

```
npm run test:dev
```
This sets an environment variable that configure the project to load the main dependency from the _src_ folder (source code in ES6) instead of the _lib_ folder (transpiled ES5 code). 

# This Is What We re Up To
We are Neap, an Australian Technology consultancy powering the startup ecosystem in Sydney. We simply love building Tech and also meeting new people, so don't hesitate to connect with us at [https://neap.co](https://neap.co).

# License
Copyright (c) 2017, Neap Pty Ltd.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
* Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
* Neither the name of Neap Pty Ltd nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL NEAP PTY LTD BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
