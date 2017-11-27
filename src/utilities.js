/** * Copyright (c) 2017, Neap Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const chain = value => ({ next: fn => chain(fn(value)), val: () => value })
/*eslint-disable */
const log = (msg, name) => {
        if (name) console.log(name + ': ', msg)
        else console.log(msg)
        return msg
    }
/*eslint-enable */
/**
 * Removes all multi-spaces with a single space + replace carriage returns with 'cr' and tabs with 't'
 * @param  {String} sch Text input
 * @param  {String} cr  Carriage return replacement
 * @param  {String} t   Tab replacement
 * @return {String}     Escaped text
 */
const escapeGraphQlSchema = (sch, cr, t) => sch.replace(/[\n\r]+/g, cr).replace(/[\t\r]+/g, t).replace(/\s+/g, ' ')
const removeMultiSpaces = s => s.replace(/ +(?= )/g,'')
const matchLeftNonGreedy = (str, startChar, endChar) => chain(str.match(new RegExp(`${startChar}(.*?)${endChar}`)))
    .next(m => m && m.length > 0
        ? chain(matchLeftNonGreedy(`${m[m.length-1]}${endChar}`, startChar, endChar)).next(v => v ? v : m).val()
        : m
    )
    .val()

module.exports = {
    chain,
    log,
    escapeGraphQlSchema,
    removeMultiSpaces,
    matchLeftNonGreedy
}