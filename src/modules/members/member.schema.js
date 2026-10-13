"use strict";

const yup = require("yup");
const {
  BLOOD_GROUPS,
  GENDER,
  PAYMENT_METHODS,
  MEMBER_STATUS,
} = require("../../shared/constants");

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

const createMemberSchema = yup.object().shape({
  firstName: yup
    .string()
    .trim()
    .required("First name is required.")
    .min(2, "First name must be at least 2 characters."),
  lastName: yup
    .string()
    .trim()
    .required("Last name is required.")
    .min(2, "Last name must be at least 2 characters."),
  email: yup
    .string()
    .trim()
    .lowercase()
    .required("Email is required.")
    .matches(EMAIL_PATTERN, "Please enter a valid email address."),
  mobile: yup
    .string()
    .trim()
    .required("Mobile number is required.")
    .test(
      "valid-phone",
      "Enter a valid mobile number (at least 10 digits).",
      (v) => {
        if (!v) return false;
        const digits = v.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 15;
      },
    ),
  gender: yup
    .string()
    .trim()
    .required("Please select a gender.")
    .oneOf(GENDER, "Gender must be Male or Female."),
  dob: yup
    .string()
    .trim()
    .required("Date of birth is required.")
    .test("valid-dob", "Date of birth is invalid.", function (value) {
      if (!value) return false;
      const birth = new Date(value);
      if (isNaN(birth.getTime())) {
        return this.createError({
          message: "Please enter a valid date of birth.",
        });
      }
      if (birth > new Date()) {
        return this.createError({
          message: "Date of birth cannot be in the future.",
        });
      }
      let age = new Date().getFullYear() - birth.getFullYear();
      const m = new Date().getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && new Date().getDate() < birth.getDate())) age--;
      if (age < 18) {
        return this.createError({
          message: "Only persons aged 18 and above are eligible.",
        });
      }
      if (age > 100) {
        return this.createError({
          message: "Please enter a valid date of birth (max age 100).",
        });
      }
      return true;
    }),
  height: yup
    .mixed()
    .nullable()
    .test("valid-height", "Height must be between 60 and 260 cm.", (v) => {
      if (v === null || v === undefined || v === "") return true;
      const num = Number(v);
      return !isNaN(num) && num >= 60 && num <= 260;
    }),
  weight: yup
    .mixed()
    .nullable()
    .test("valid-weight", "Weight must be between 25 and 300 kg.", (v) => {
      if (v === null || v === undefined || v === "") return true;
      const num = Number(v);
      return !isNaN(num) && num >= 25 && num <= 300;
    }),
  bloodGroup: yup
    .string()
    .nullable()
    .oneOf([...BLOOD_GROUPS, "", null]),
  address: yup
    .string()
    .trim()
    .required("Address is required.")
    .min(5, "Address must be at least 5 characters."),
  city: yup.string().trim().required("City is required.").min(2),
  state: yup.string().trim().required("State is required.").min(2),
  country: yup.string().trim().default("India"),
  pincode: yup
    .string()
    .trim()
    .required("Pincode is required.")
    .matches(PINCODE_PATTERN, "Please enter a valid 6-digit pincode."),
  emergencyName: yup
    .string()
    .trim()
    .required("Emergency contact name is required.")
    .min(2),
  emergencyRelationship: yup.string().trim().nullable(),
  emergencyRelation: yup.string().trim().nullable(),
  emergencyNumber: yup
    .string()
    .trim()
    .nullable()
    .test(
      "valid-phone",
      "Please enter a valid contact number (at least 7 digits).",
      (v) => {
        if (!v) return true;
        return v.replace(/\D/g, "").length >= 7;
      },
    ),
  emergencyPhone: yup.string().trim().nullable(),
  bio: yup.string().trim().nullable().default(""),

  // Batch & membership selection
  batchId: yup.string().trim().nullable(),
  batchName: yup.string().trim().nullable(),
  batchTiming: yup.string().trim().nullable(),
  assignedBatch: yup.string().trim().nullable(),
  shift: yup.string().trim().nullable(),
  schedule: yup.mixed().nullable(),
  batchHistory: yup.array().nullable(),
  activeFlexAssignments: yup.array().nullable(),
  photo: yup.string().trim().nullable(),
  photoUrl: yup.string().trim().nullable(),
  photoName: yup.string().trim().nullable(),
  status: yup
    .string()
    .oneOf(Object.values(MEMBER_STATUS))
    .nullable()
    .default(MEMBER_STATUS.ACTIVE),

  // Optional medical doc
  medicalDoc: yup.mixed().nullable(),
  medicalDocName: yup.string().trim().nullable(),
  medicalDocSize: yup.string().trim().nullable(),

  // Optional plan & payment details at registration
  paymentPlanId: yup.string().trim().nullable(),
  planId: yup.string().trim().nullable(),
  membershipPlan: yup.mixed().nullable(),
  paymentDetails: yup.mixed().nullable(),
  paymentMethod: yup
    .string()
    .trim()
    .oneOf([...PAYMENT_METHODS, "", null])
    .nullable(),
  paymentAmount: yup.number().nullable().min(0),
  transactionId: yup.string().trim().nullable(),
  paymentDate: yup.string().trim().nullable(),
  paymentNotes: yup.string().trim().nullable(),
});

const updateMemberSchema = yup.object().shape({
  firstName: yup.string().trim().min(2).nullable(),
  lastName: yup.string().trim().min(2).nullable(),
  email: yup.string().trim().lowercase().matches(EMAIL_PATTERN).nullable(),
  mobile: yup.string().trim().nullable(),
  gender: yup
    .string()
    .trim()
    .oneOf([...GENDER, "", null])
    .nullable(),
  dob: yup.string().trim().nullable(),
  height: yup.mixed().nullable(),
  weight: yup.mixed().nullable(),
  bloodGroup: yup
    .string()
    .nullable()
    .oneOf([...BLOOD_GROUPS, "", null]),
  address: yup.string().trim().nullable(),
  city: yup.string().trim().nullable(),
  state: yup.string().trim().nullable(),
  country: yup.string().trim().nullable(),
  pincode: yup.string().trim().nullable(),
  bio: yup.string().trim().nullable(),
  status: yup.string().oneOf(Object.values(MEMBER_STATUS)).nullable(),
  batchId: yup.string().trim().nullable(),
  batchName: yup.string().trim().nullable(),
  batchTiming: yup.string().trim().nullable(),
  assignedBatch: yup.string().trim().nullable(),
  shift: yup.string().trim().nullable(),
  schedule: yup.mixed().nullable(),
  batchHistory: yup.array().nullable(),
  activeFlexAssignments: yup.array().nullable(),
  emergencyName: yup.string().trim().nullable(),
  emergencyRelationship: yup.string().trim().nullable(),
  emergencyRelation: yup.string().trim().nullable(),
  emergencyNumber: yup.string().trim().nullable(),
  emergencyPhone: yup.string().trim().nullable(),
  photo: yup.string().trim().nullable(),
  photoUrl: yup.string().trim().nullable(),
  photoName: yup.string().trim().nullable(),
  medicalDoc: yup.mixed().nullable(),
  medicalDocName: yup.string().trim().nullable(),
  medicalDocSize: yup.string().trim().nullable(),
  membershipPlan: yup.mixed().nullable(),
  paymentDetails: yup.mixed().nullable(),
});

const convertLeadSchema = yup.object().shape({
  paymentPlanId: yup.string().trim().required("Membership plan is required."),
  paymentMethod: yup
    .string()
    .trim()
    .oneOf(PAYMENT_METHODS, "Please select a valid payment method.")
    .required(),
  paymentAmount: yup.number().required("Payment amount is required.").min(0),
  transactionId: yup.string().trim().nullable(),
  paymentDate: yup.string().trim().nullable(),
  paymentNotes: yup.string().trim().nullable(),
  batchId: yup.string().trim().nullable(),
  photo: yup.string().trim().nullable(),
  photoName: yup.string().trim().nullable(),
});

module.exports = {
  createMemberSchema,
  updateMemberSchema,
  convertLeadSchema,
};
