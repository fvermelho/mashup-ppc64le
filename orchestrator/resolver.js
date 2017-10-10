/* jshint node: true */
"use strict";

var util = require('util');

function cloneSimpleObject(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function tokenize(text, token) {
  let ret = [];
  let remainder = text;

  let beginIndex = remainder.indexOf(token);
  while (beginIndex >= 0) {
    let begin = remainder.slice(0, beginIndex);
    remainder = remainder.slice(beginIndex + token.length);
    ret.push(begin);
    beginIndex = remainder.indexOf(token);
  }
  ret.push(remainder);
  return ret;
}

function accessVariable(obj, path, specialVars) {
  let pathIndex = 0;
  let currObj = obj;
  let ret = {
    'result' : 'ok',
    'data' : ""
  };
  let isSpecial = false;

  if (specialVars != undefined) {
    for (let i = 0; i < specialVars.tags.length; i++) {
      if (path[0] === specialVars.tags[i]) {
        let usedVar = '';
        for (let j = 1; j < path.length; j++) {
          usedVar += path[j] + '.';
        }
        // There might be a better way to deal with trailing dots.
        usedVar = usedVar.slice(0, -1);
        specialVars.used.push(usedVar);
        ret.data = '${' + usedVar + '}';
        isSpecial = true;
      }
    }
  }

  if (isSpecial === false) {
    while (pathIndex < path.length) {
      if (path[pathIndex] in currObj) {
        if (pathIndex == path.length - 1) {
          ret.data = currObj[path[pathIndex]];
          break;
        } else {
          currObj = currObj[path[pathIndex]];
          pathIndex++;
        }
      } else {
        ret.result = 'not found';
        ret.data = path;
        break;
      }
    }
  }

  return ret;
}


function expandVariable(obj, variable, specialVars, varTracking) {
  let ret = {
    'result' : 'ok',
    'data' : {}
  }

  let internalTraking = cloneSimpleObject(varTracking);

  if (variable in internalTraking) {
    ret.result = 'circular reference';
  } else {
    let path = tokenize(variable, '.');
    ret = accessVariable(obj, path, specialVars);
    if (ret.result === 'ok') {
      internalTraking[variable] = true;
      ret = resolveVariables(obj, ret.data, specialVars, internalTraking);
    }
  }
  return ret;
}


/**
 * Converts a moustache-encoded string into a bash-like text, returning
 * all used variables.
 *
 * Example:
 * let text: "Attributes {{payload.attr1}} and {{payload.attr2}}"
 * Calling resolveVariabled(text) will return
 * translatedTemplate:  "Attributes ${attr1} and ${attr2}"
 * inputVariables: ["attr1", "attr2"]
 *
 * @param {string} template The template to be transformed
 */
function resolveVariables(obj, text, specialVars, varTracking) {
  let ret = {
    'result' : 'ok',
    'data' : text
  }

  if (varTracking === undefined) {
    varTracking = {};
  }

  if (typeof text === 'string') {
    let tokens = /\"?\{{2}(.+?)\}{2}\"?/g.exec(ret.data);

    while (tokens != null) {
      let expansion = expandVariable(obj, tokens[1], specialVars, varTracking);
      if (expansion.result === 'ok') {
        ret.data = ret.data.replace(new RegExp('\{{2}(' + tokens[1] + ')\}{2}', 'g'), expansion.data);
      } else {
        ret.result = expansion.result;
        ret.data = expansion.data;
        break;
      }
      tokens = /\"?\{{2}(.+?)\}{2}\"?/g.exec(ret.data);
    }
  }
  return ret;
}

exports.resolveVariables = resolveVariables;
exports.accessVariable = accessVariable;
