# Tips On How To Debug
## Tip 1 - Have a look at the overal AST object

Most of the bugs we've received so far come from errors in the way the schema is parsed into an AST. If there is an error in that AST, then the rebuilt schema is also compromised. So when an error similar to `My transpiled schema is not working` arises, start by looking into the output of the `_getSchemaBits` function in the `src/graphqls2s.js` file.
