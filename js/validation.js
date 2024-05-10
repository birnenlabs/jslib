/**
 * @param {Object} obj
 * @param {Object} toCheck
 * @param {string[]} optionalKeys
 * @return {void}
 */
export function validateClass(obj, toCheck, optionalKeys = []) {
  const allowedKeys = new Set(Object.keys(obj));
  const requiredKeys = calculateRequiredKeys(Object.keys(obj), optionalKeys);

  // We need to detect the following problems:
  //   - missing required keys => (requiredKeys - actualKeys) should be empty
  //   - unexpected keys => (actualKeys - allowedKeys) should be empty
  //   - missing values => toCheck[actualKey] should be set

  const unexpectedKeys = [];
  const missingValues = [];
  Object.keys(toCheck).forEach(
      (toCheckKey) => {
        // Set.delete returns deleted value if it existed.
        // Let's use it to detect if the key was required and
        // check if the value is set.
        if (requiredKeys.delete(toCheckKey)) {
          if (toCheck[toCheckKey] !== 0 && !toCheck[toCheckKey]) {
            missingValues.push(toCheckKey);
          }
        }

        if (!allowedKeys.has(toCheckKey)) {
          // Only allowed keys should exist
          unexpectedKeys.push(toCheckKey);
        }
      });
  // At this point requiredKeys, missingValues and unexpectedKeys should be empty
  if (requiredKeys.size !== 0 || missingValues.length !== 0 || unexpectedKeys.length !== 0) {
    throw new Error(
        (requiredKeys.size === 0 ? '' : ` Missing properties: ${[...requiredKeys]}.`) +
                    (unexpectedKeys.length === 0 ? '' : ` Unexpected properties: ${unexpectedKeys}.`) +
                    (missingValues.length === 0 ? '' : ` Missing values: ${missingValues}.`),

    );
  }
}

/**
 * @param {string[]} allowedKeys
 * @param {string[]} optionalKeys
 * @return {Set<string>}
 */
function calculateRequiredKeys(allowedKeys, optionalKeys) {
  const result = new Set(allowedKeys);
  for (const optionalKey of optionalKeys) {
    result.delete(optionalKey);
  }
  return result;
}
