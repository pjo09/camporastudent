// ===============================================
// Express 5 compatible MongoDB injection sanitizer
// ===============================================
// WHY THIS EXISTS:
//   express-mongo-sanitize@2.2.0 (latest) assigns
//   `req[key] = target` (line 113) for 'body', 'params',
//   'headers' and 'query'. Express 5 defines `req.query`
//   as a getter-only property (via Object.defineProperty
//   in lib/request.js -> defineGetter). Assignment to a
//   getter-only property throws:
//     TypeError: Cannot set property query of #<IncomingMessage>
//               which has only a getter
//   This breaks EVERY request on Express 5.
//
// THIS MODULE:
//   Re-implements the exact same sanitization logic
//   (keys matching /^\$|\./ are stripped, with optional
//   replaceWith), but sanitizes the parsed query object
//   IN PLACE instead of re-assigning req.query, so it
//   works on both Express 4 and Express 5.
//
//   Behavior is identical to express-mongo-sanitize:
//     - strips keys starting with '$' or containing '.'
//     - supports options { replaceWith, dryRun, onSanitize }
//     - protects against prototype pollution
// ===============================================

'use strict';

const TEST_REGEX = /^\$|\./;
const TEST_REGEX_WITHOUT_DOT = /^\$/;
const REPLACE_REGEX = /^\$|\./g;

function isPlainObject(obj) {
  return typeof obj === 'object' && obj !== null;
}

function getTestRegex(allowDots) {
  return allowDots ? TEST_REGEX_WITHOUT_DOT : TEST_REGEX;
}

function withEach(target, cb) {
  (function act(obj) {
    if (Array.isArray(obj)) {
      obj.forEach(act);
    } else if (isPlainObject(obj)) {
      Object.keys(obj).forEach(function (key) {
        const val = obj[key];
        const resp = cb(obj, val, key);
        if (resp && resp.shouldRecurse) {
          act(obj[resp.key || key]);
        }
      });
    }
  })(target);
}

function _sanitize(target, options) {
  const regex = getTestRegex(options.allowDots);

  let isSanitized = false;
  let replaceWith = null;
  const dryRun = Boolean(options.dryRun);
  if (!regex.test(options.replaceWith) && options.replaceWith !== '.') {
    replaceWith = options.replaceWith;
  }

  withEach(target, function (obj, val, key) {
    let shouldRecurse = true;

    if (regex.test(key)) {
      isSanitized = true;
      // if dryRun is enabled, do not modify the target
      if (dryRun) {
        return {
          shouldRecurse: shouldRecurse,
          key: key,
        };
      }
      delete obj[key];
      if (replaceWith) {
        const newKey = key.replace(REPLACE_REGEX, replaceWith);
        // Avoid setting __proto__ and constructor.prototype
        if (
          newKey !== '__proto__' &&
          newKey !== 'constructor' &&
          newKey !== 'prototype'
        ) {
          obj[newKey] = val;
        }
      } else {
        shouldRecurse = false;
      }
    }

    return {
      shouldRecurse: shouldRecurse,
      key: key,
    };
  });

  return {
    isSanitized,
    target,
  };
}

/**
 * Express 5 compatible middleware.
 * Sanitizes req.body, req.params, req.headers and req.query.
 *
 * @param {{replaceWith?: string, dryRun?: boolean, onSanitize?: function}} options
 * @returns {function}
 */
function middleware(options = {}) {
  const hasOnSanitize = typeof options.onSanitize === 'function';
  return function (req, res, next) {
    try {
      ['body', 'params', 'headers', 'query'].forEach(function (key) {
        if (req[key]) {
          const { isSanitized } = _sanitize(req[key], options);
          if (isSanitized && hasOnSanitize) {
            options.onSanitize({ req, key });
          }
        }
      });
    } catch (err) {
      return next(err);
    }
    next();
  };
}

module.exports = middleware;
module.exports.sanitize = sanitize;

// preserve the sanitize() helper name for parity with the original package
function sanitize(target, options = {}) {
  return _sanitize(target, options).target;
}

