# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="0.9.4"></a>
## [0.9.4](https://github.com/nicolasdao/graphql-s2s/compare/v0.9.3...v0.9.4) (2018-01-19)


### Bug Fixes

* Boolean is not supported while analysing graphql queries ([380f92b](https://github.com/nicolasdao/graphql-s2s/commit/380f92b))



<a name="0.9.3"></a>
## [0.9.3](https://github.com/nicolasdao/graphql-s2s/compare/v0.9.2...v0.9.3) (2018-01-14)



<a name="0.9.2"></a>
## [0.9.2](https://github.com/nicolasdao/graphql-s2s/compare/v0.9.1...v0.9.2) (2018-01-13)


### Bug Fixes

* Operation name does not work when multiple queries are defined in the request. ([9d648b9](https://github.com/nicolasdao/graphql-s2s/commit/9d648b9))



<a name="0.9.1"></a>
## [0.9.1](https://github.com/nicolasdao/graphql-s2s/compare/v0.9.0...v0.9.1) (2018-01-12)


### Bug Fixes

* getQueryAST throws an error when variables are of type array. ([51eab6b](https://github.com/nicolasdao/graphql-s2s/commit/51eab6b))



<a name="0.9.0"></a>
# [0.9.0](https://github.com/nicolasdao/graphql-s2s/compare/v0.8.0...v0.9.0) (2018-01-12)


### Features

* Add new 'paths' api on the query AST object ([06dfa24](https://github.com/nicolasdao/graphql-s2s/commit/06dfa24))



<a name="0.8.0"></a>
# [0.8.0](https://github.com/nicolasdao/graphql-s2s/compare/v0.7.0...v0.8.0) (2018-01-12)


### Features

* Add new 'some' api on the queryAST object ([fbc951f](https://github.com/nicolasdao/graphql-s2s/commit/fbc951f))



<a name="0.7.0"></a>
# [0.7.0](https://github.com/nicolasdao/graphql-s2s/compare/v0.6.0...v0.7.0) (2018-01-12)


### Bug Fixes

* Defragging strips out the metadata from the AST ([a8444bb](https://github.com/nicolasdao/graphql-s2s/commit/a8444bb))


### Features

* Add support for defragmenting a query (i.e. injecting all fragments into the operation) ([058c49c](https://github.com/nicolasdao/graphql-s2s/commit/058c49c))



<a name="0.6.0"></a>
# [0.6.0](https://github.com/nicolasdao/graphql-s2s/compare/v0.5.0...v0.6.0) (2018-01-11)


### Features

* Add support for dealing with schema queries ([19785e3](https://github.com/nicolasdao/graphql-s2s/commit/19785e3))



<a name="0.5.0"></a>
# [0.5.0](https://github.com/nicolasdao/graphql-s2s/compare/v0.4.1...v0.5.0) (2018-01-11)


### Features

* Add support for analysing Graphql Queries, modifying them, and rebuilding them ([1821fad](https://github.com/nicolasdao/graphql-s2s/commit/1821fad))



<a name="0.4.1"></a>
## [0.4.1](https://github.com/nicolasdao/graphql-s2s/compare/v0.4.0...v0.4.1) (2018-01-09)


### Bug Fixes

* getQueryASP fails when the query is empty ([116ff0f](https://github.com/nicolasdao/graphql-s2s/commit/116ff0f))



<a name="0.4.0"></a>
# [0.4.0](https://github.com/nicolasdao/graphql-s2s/compare/v0.3.3...v0.4.0) (2018-01-08)


### Features

* Add new 'getQueryAST' api whoch allows to inspect the current graphql request to extract metadata ([2163ecb](https://github.com/nicolasdao/graphql-s2s/commit/2163ecb))



<a name="0.3.3"></a>
## [0.3.3](https://github.com/nicolasdao/graphql-s2s/compare/v0.3.2...v0.3.3) (2018-01-08)



<a name="0.3.2"></a>
## [0.3.2](https://github.com/nicolasdao/graphql-s2s/compare/v0.3.1...v0.3.2) (2017-11-27)


### Bug Fixes

* Add support for 'scalar' keyword ([351e2e5](https://github.com/nicolasdao/graphql-s2s/commit/351e2e5))
* Add support for 'union' keyword ([e89358e](https://github.com/nicolasdao/graphql-s2s/commit/e89358e))
* Compile ES6 to ES5 to add support for both 'scalar' and 'union' keywords ([3bb4992](https://github.com/nicolasdao/graphql-s2s/commit/3bb4992))



<a name="0.3.1"></a>
## [0.3.1](https://github.com/nicolasdao/graphql-s2s/compare/v0.3.0...v0.3.1) (2017-10-28)


### Bug Fixes

* Bug [#1](https://github.com/nicolasdao/graphql-s2s/issues/1). Add support for the 'extend' keyword ([8de6018](https://github.com/nicolasdao/graphql-s2s/commit/8de6018))



<a name="0.3.0"></a>
# [0.3.0](https://github.com/nicolasdao/graphql-s2s/compare/v0.2.1...v0.3.0) (2017-07-28)


### Features

* Add support for alias name on generic types ([2436a0f](https://github.com/nicolasdao/graphql-s2s/commit/2436a0f))



<a name="0.2.1"></a>
## [0.2.1](https://github.com/nicolasdao/graphql-s2s/compare/v0.2.0...v0.2.1) (2017-06-13)


### Bug Fixes

* Remove babel-polyfill ([cc24afe](https://github.com/nicolasdao/graphql-s2s/commit/cc24afe))



<a name="0.2.0"></a>
# [0.2.0](https://github.com/nicolasdao/graphql-s2s/compare/v0.1.2...v0.2.0) (2017-06-13)


### Features

* Convert project to ES5 so it can run in the browser. Using webpack, eslint and babel + adding support for browser testing ([4bfbb77](https://github.com/nicolasdao/graphql-s2s/commit/4bfbb77))



<a name="0.1.2"></a>
## [0.1.2](https://github.com/nicolasdao/graphql-s2s/compare/v0.1.1...v0.1.2) (2017-06-13)


### Bug Fixes

* Fix lint issues ([4b9d69d](https://github.com/nicolasdao/graphql-s2s/commit/4b9d69d))
* Lint all code ([d744392](https://github.com/nicolasdao/graphql-s2s/commit/d744392))



<a name="0.1.1"></a>
## [0.1.1](https://github.com/nicolasdao/graphql-s2s/compare/v0.0.9...v0.1.1) (2017-06-12)



<a name="0.0.9"></a>
## [0.0.9](https://github.com/nicolasdao/graphql-s2s/compare/v0.0.8...v0.0.9) (2017-06-12)


### Bug Fixes

* Rename one API to something more meaningfull(getSchemaParts -> getSchemaAST) ([811d873](https://github.com/nicolasdao/graphql-s2s/commit/811d873))



<a name="0.0.8"></a>
## [0.0.8](https://github.com/nicolasdao/graphql-s2s/compare/v0.0.6...v0.0.8) (2017-06-06)


### Bug Fixes

* Amend test description + add a collaborators.md file ([86915ec](https://github.com/nicolasdao/graphql-s2s/commit/86915ec))
* support for complex commenting + amended documentation. ([7648c0f](https://github.com/nicolasdao/graphql-s2s/commit/7648c0f))



<a name="0.0.7"></a>
## [0.0.7](https://github.com/nicolasdao/graphql-s2s/compare/v0.0.6...v0.0.7) (2017-06-06)


### Bug Fixes

* support for complex commenting + amended documentation. ([7648c0f](https://github.com/nicolasdao/graphql-s2s/commit/7648c0f))



<a name="0.0.6"></a>
## [0.0.6](https://github.com/nicolasdao/graphql-s2s/compare/v0.0.5...v0.0.6) (2017-06-02)



<a name="0.0.5"></a>
## [0.0.5](https://github.com/nicolasdao/graphql-s2s/compare/v0.0.4...v0.0.5) (2017-06-02)



<a name="0.0.4"></a>
## [0.0.4](https://github.com/neapers/graphql-s2s/compare/v0.0.3...v0.0.4) (2017-06-01)



<a name="0.0.3"></a>
## [0.0.3](https://github.com/neapers/graphql-s2s/compare/0.0.2...v0.0.3) (2017-06-01)
