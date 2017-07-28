/**
 * Copyright (c) 2017, Neap Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
/*eslint-disable */
const env = process.env.MOCHA_ENV || 'prod'
/*eslint-enable */
const { assert } = require('chai')
let graphqls2s = null
if (env == 'prod')
	graphqls2s = require('../../lib/graphqls2s.min').graphqls2s
else if (env == 'dev')
	graphqls2s = require('../../src/graphqls2s').graphqls2s
else
	throw new Error(`Failed to test - Environment ${env} is unknown.`)

const { runtest } = require('../browser/graphqls2s')

runtest(graphqls2s, assert)