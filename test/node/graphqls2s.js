/**
 * Copyright (c) 2017, Neap Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const _ = require('lodash')
const { inspect } = require('util')
const { assert } = require('chai')
const { graphqls2s } = require('../../lib/graphqls2s.min')
const { runtest } = require('../browser/graphqls2s')

runtest(graphqls2s, assert)