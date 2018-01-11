/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

module.exports.invariant = (condition, message) => {
  /* istanbul ignore else */
  if (!condition) {
    throw new Error(message)
  }
}