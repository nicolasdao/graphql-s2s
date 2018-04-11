# GraghQL Schema-2-Schema Transpiler &middot;  [![NPM](https://img.shields.io/npm/v/graphql-s2s.svg?style=flat)](https://www.npmjs.com/package/graphql-s2s) [![Tests](https://travis-ci.org/nicolasdao/graphql-s2s.svg?branch=master)](https://travis-ci.org/nicolasdao/graphql-s2s) [![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause) [![Neap](https://neap.co/img/made_by_neap.svg)](#this-is-what-we-re-up-to)

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
* [**Deconstructing - Transforming - Rebuilding Queries**](#deconstructing---transforming---rebuilding-queries)

# Install
### node
```js
npm install graphql-s2s --save
```
### browser
```html
<script src="https://unpkg.com/graphql-s2s@0.11.2/lib/graphqls2s.min.js"></script>
```
> Using the awesome [unpkg.com](https://unpkg.com), all versions are supported at https<span>://unpkg</span>.com/graphql-s2s@__*:VERSION*__/lib/graphqls2s.min.js.
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

## Single Inheritance

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

## Multiple Inheritance

```js
const schema = `

type Node {
	id: ID!
}

type Address {
	streetAddress: String
	city: String
	state: String
}

# Inheriting from the 'Node' & 'Adress' type
type Person inherits Node, Address {
	id: ID!
	streetAddress: String
	city: String
	state: String
	firstname: String
	lastname: String
}

`
```

More details in the [code below](#type-inheritance).

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

More details in the [code below](#generic-types).

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

[**Deconstructing - Transforming - Rebuilding Queries**](#deconstructing---transforming---rebuilding-queries)

This feature allows your GraphQl server to deconstruct any GraphQl query as an AST that can then be filtered and modified based on your requirements. That AST can then be rebuilt as a valid GraphQL query. A great example of that feature in action is the [__graphql-authorize__](https://github.com/nicolasdao/graphql-authorize.git) middleware for [__graphql-serverless__](https://github.com/nicolasdao/graphql-serverless) which filters query's properties based on the user's rights.

For a concrete example, refer to the [code below](#deconstructing-transforming-rebuilding-queries).

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
### Deconstructing - Transforming - Rebuilding Queries
This feature allows your GraphQl server to deconstruct any GraphQl query as an AST that can then be filtered and modified based on your requirements. That AST can then be rebuilt as a valid GraphQL query. A great example of that feature in action is the [__graphql-authorize__](https://github.com/nicolasdao/graphql-authorize.git) middleware for [__graphql-serverless__](https://github.com/nicolasdao/graphql-serverless) which filters query's properties based on the user's rights.

```js
const { getQueryAST, buildQuery, getSchemaAST } = require('graphql-s2s').graphqls2s
const schema = `
	type Property {
		name: String
		@auth
		address: String
	}
	
	input InputWhere {
		name: String
		locations: [LocationInput]
	}
	
	input LocationInput {
		type: String 
		value: String
	}
	
	type Query {
		properties(where: InputWhere): [Property]
	}`

const query = `
	query {
		properties(where: { name: "Love", locations: [{ type: "house", value: "Bellevue hill" }] }){
			name
			address
		}
	}`

const schemaAST = getSchemaAST(schema)
const queryAST = getQueryAST(query, null, schemaAST)
const rebuiltQuery = buildQuery(queryAST.filter(x => !x.metadata || x.metadata.name != 'auth'))

//	query {
//		properties(where:{name:"Love",locations:[{type:"house",value:"Bellevue hill"}]}){
//			name
//		}
// 	}
```

Notice that the original query was requesting the `address` property. Because we decorated that property with the custom metadata `@auth` (feature demonstrated previously [Metadata Decoration](#metadata-decoration)), we were able to filter that property to then rebuilt the query without it.

#### API

__*getQueryAST(query, operationName, schemaAST, options): QueryAST*__

Returns an GraphQl query AST.

| Arguments      | type    | Description  |
| :------------- |:-------:| :------------ |
| query      	 | String  | GraphQl Query. |
| operationName  | String  | GraphQl query operation. Only useful if multiple operations are defined in a single query, otherwise use `null`. |
| schemaAST      | Object  | Original GraphQl schema AST obtained thanks to the `getSchemaAST` function. |
| options.defrag | Boolean | If set to true and if the query contained fragments, then all fragments are replaced by their explicit definition in the AST. |

__*QueryAST Object Structure*__

| Properties | type   | Description  |
| :--------- |:------:| :------------ |
| name    	 | String | Field's name. |
| kind       | String | Field's kind. |
| type       | String | Field's type. |
| metadata   | String | Field's metadata. |
| args       | Array  | Array of argument objects. |
| properties | Array  | Array of QueryAST objects. |

__*QueryAST.filter((ast:QueryAST) => ...): QueryAST*__

Returns a new QueryAST object where only ASTs complying to the predicate `ast => ...` are left.

__*QueryAST.propertyPaths((ast:QueryAST) => ...): [String]*__

Returns an array of strings. Each one represents the path to the query property that matches the predicate `ast => ...`.

__*QueryAST.some((ast:QueryAST) => ...): Boolean*__

Returns a boolean indicating whether the QueryAST contains at least one AST matching the predicate `ast => ...`.

__*buildQuery(QueryAST): String*__

Rebuilds a valid GraphQl query from a QueryAST object.

# Contribute
## Step 1. Don't Forget To Test Your Feature
We only accept pull request that have been thoroughly tested. To do so, simply add your test under the `test/browser/graphqls2s.js` file. 

Once that's done, simply run your the following command to test your features:
```
npm run test:dev
```
This sets an environment variable that configure the project to load the main dependency from the _src_ folder (source code in ES6) instead of the _lib_ folder (transpiled ES5 code). 

## Step 2. Compile & Rerun Your Test Before Pushing
```
npm run dev
npm run built
npm test
```
This project is built using Javascript ES6. Each version is also transpiled to ES5 using Babel through Webpack 2, so this project can run in the browser. In order to write unit test only once instead of duplicating it for each version of Javascript, the all unit tests have been written using Javascript ES5 in mocha. That means that if you want to test the project after some changes, you will need to first transpile the project to ES5. 

# This Is What We re Up To
We are Neap, an Australian Technology consultancy powering the startup ecosystem in Sydney. We simply love building Tech and also meeting new people, so don't hesitate to connect with us at [https://neap.co](https://neap.co).

Our other open-sourced projects:
#### Web Framework & Deployment Tools
* [__*webfunc*__](https://github.com/nicolasdao/webfunc): Write code for serverless similar to Express once, deploy everywhere. 
* [__*now-flow*__](https://github.com/nicolasdao/now-flow): Automate your Zeit Now Deployments.

#### GraphQL
* [__*graphql-serverless*__](https://github.com/nicolasdao/graphql-serverless): GraphQL (incl. a GraphiQL interface) middleware for [webfunc](https://github.com/nicolasdao/webfunc).
* [__*schemaglue*__](https://github.com/nicolasdao/schemaglue): Naturally breaks down your monolithic graphql schema into bits and pieces and then glue them back together.
* [__*graphql-s2s*__](https://github.com/nicolasdao/graphql-s2s): Add GraphQL Schema support for type inheritance, generic typing, metadata decoration. Transpile the enriched GraphQL string schema into the standard string schema understood by graphql.js and the Apollo server client.
* [__*graphql-authorize*__](https://github.com/nicolasdao/graphql-authorize.git): Authorization middleware for [graphql-serverless](https://github.com/nicolasdao/graphql-serverless). Add inline authorization straight into your GraphQl schema to restrict access to certain fields based on your user's rights.

#### React & React Native
* [__*react-native-game-engine*__](https://github.com/bberak/react-native-game-engine): A lightweight game engine for react native.
* [__*react-native-game-engine-handbook*__](https://github.com/bberak/react-native-game-engine-handbook): A React Native app showcasing some examples using react-native-game-engine.

#### Tools
* [__*aws-cloudwatch-logger*__](https://github.com/nicolasdao/aws-cloudwatch-logger): Promise based logger for AWS CloudWatch LogStream.


# License
Copyright (c) 2018, Neap Pty Ltd.
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

<p align="center"><a href="https://neap.co" target="_blank"><img src="https://neap.co/img/neap_color_horizontal.png" alt="Neap Pty Ltd logo" title="Neap" height="89" width="200"/></a></p>
