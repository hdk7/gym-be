"use strict";

const { ValidationError } = require("../shared/apiError");

/**
 * Yup schema validation middleware factory.
 *
 * Usage in a route file:
 *   const { validate } = require("../../middleware/validate.middleware");
 *   router.post("/", validate(createMemberSchema), ctrl.create);
 *
 * Behaviour:
 *   1. Runs Yup validation against req[target] (default: "body")
 *   2. Strips unknown fields (stripUnknown: true) — prevents field injection
 *   3. Collects ALL errors before rejecting (abortEarly: false)
 *   4. On failure → throws a 422 ValidationError with field-level detail
 *   5. On success → replaces req[target] with the sanitized/cast data
 *
 * @param {import('yup').Schema} schema  - Yup object schema to validate against
 * @param {"body"|"query"|"params"} target - Which part of req to validate
 * @returns {import('express').RequestHandler}
 */
function validate(schema, target = "body") {
  return async (req, res, next) => {
    try {
      // validate() casts types + strips unknowns + collects all errors
      const sanitized = await schema.validate(req[target], {
        abortEarly: false,
        stripUnknown: true,
      });

      // Replace raw input with sanitized, type-cast data
      req[target] = sanitized;
      next();
    } catch (err) {
      if (err.name === "ValidationError") {
        // Map Yup inner errors to { field, message } objects
        const fieldErrors = (err.inner || []).map((e) => ({
          field: e.path || "_form",
          message: e.message,
        }));

        // If no inner errors, the top-level message is the only error
        if (fieldErrors.length === 0) {
          fieldErrors.push({ field: "_form", message: err.message });
        }

        return next(
          new ValidationError(
            "Validation failed. Please check the submitted fields.",
            fieldErrors
          )
        );
      }

      // Unexpected non-Yup error — pass to global error handler
      next(err);
    }
  };
}

/**
 * Validate query string parameters against a Yup schema.
 * Convenience wrapper for validate(schema, "query").
 *
 * @param {import('yup').Schema} schema
 * @returns {import('express').RequestHandler}
 */
function validateQuery(schema) {
  return validate(schema, "query");
}

/**
 * Validate URL parameters against a Yup schema.
 * Convenience wrapper for validate(schema, "params").
 *
 * @param {import('yup').Schema} schema
 * @returns {import('express').RequestHandler}
 */
function validateParams(schema) {
  return validate(schema, "params");
}

module.exports = { validate, validateQuery, validateParams };
