"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createPublicTicketAction,
  EMPTY_PUBLIC_TICKET_VALUES,
  type CreatePublicTicketFormState,
} from "./public-actions";
import type {
  RequestFormCategory,
  RequestFormDepartment,
  RequestFormLocation,
} from "./request-form";

const INITIAL_STATE: CreatePublicTicketFormState = {
  status: "idle",
  fieldErrors: {},
  values: EMPTY_PUBLIC_TICKET_VALUES,
};

export function PublicRequestForm({
  departments,
  categories,
  serviceLocations,
}: {
  departments: RequestFormDepartment[];
  categories: RequestFormCategory[];
  serviceLocations: RequestFormLocation[];
}) {
  const [state, formAction] = useActionState(
    createPublicTicketAction,
    INITIAL_STATE,
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(
    () => state.values.departmentId,
  );

  const selectedDepartment = departments.find(
    (department) => department.id === selectedDepartmentId,
  );
  const filteredCategories = categories.filter(
    (category) => category.departmentId === selectedDepartmentId,
  );

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      {/* Honeypot: visually hidden from sighted users and never given an
          accessible label, but still present in the DOM and tab order for
          a simple automated form filler to find. A real user never sees
          or fills this in; a nonzero value here is treated as automated
          and silently discarded server-side. */}
      <div
        aria-hidden="true"
        className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
      >
        <label htmlFor="company_website">Leave this field blank</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="requesterName" className="text-sm font-semibold">
          Your name
        </label>
        <input
          id="requesterName"
          name="requesterName"
          type="text"
          defaultValue={state.values.requesterName}
          maxLength={200}
          required
          autoComplete="name"
          aria-describedby={
            state.fieldErrors.requesterName ? "requesterName-error" : undefined
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        {state.fieldErrors.requesterName && (
          <p
            id="requesterName-error"
            role="alert"
            className="text-sm text-red-700 dark:text-red-400"
          >
            {state.fieldErrors.requesterName}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="requesterEmail" className="text-sm font-semibold">
          Your email
        </label>
        <input
          id="requesterEmail"
          name="requesterEmail"
          type="email"
          defaultValue={state.values.requesterEmail}
          maxLength={320}
          required
          autoComplete="email"
          aria-describedby={
            state.fieldErrors.requesterEmail
              ? "requesterEmail-error"
              : "requesterEmail-help"
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <p
          id="requesterEmail-help"
          className="text-sm text-slate-500 dark:text-slate-400"
        >
          Our support team will contact you at this address.
        </p>
        {state.fieldErrors.requesterEmail && (
          <p
            id="requesterEmail-error"
            role="alert"
            className="text-sm text-red-700 dark:text-red-400"
          >
            {state.fieldErrors.requesterEmail}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Help area</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          {departments.map((department) => (
            <label
              key={department.id}
              className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${
                selectedDepartmentId === department.id
                  ? "border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-900"
                  : "border-slate-300 dark:border-slate-700"
              }`}
            >
              <input
                type="radio"
                name="departmentId"
                value={department.id}
                defaultChecked={state.values.departmentId === department.id}
                onChange={() => setSelectedDepartmentId(department.id)}
                required
                className="h-4 w-4"
              />
              {department.name}
            </label>
          ))}
        </div>
        {state.fieldErrors.departmentId && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.fieldErrors.departmentId}
          </p>
        )}
      </fieldset>

      {selectedDepartment?.code === "FACILITIES" && (
        <p
          role="note"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          For an active emergency (fire, gas leak, major flooding, or a safety
          threat), follow TEACH emergency procedures and call 911. Do not rely
          on this form alone to report an emergency.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="serviceLocationId" className="text-sm font-semibold">
          Location
        </label>
        <select
          id="serviceLocationId"
          name="serviceLocationId"
          defaultValue={state.values.serviceLocationId}
          required
          aria-describedby={
            state.fieldErrors.serviceLocationId
              ? "serviceLocationId-error"
              : undefined
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">Select a location</option>
          {serviceLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
        {state.fieldErrors.serviceLocationId && (
          <p
            id="serviceLocationId-error"
            role="alert"
            className="text-sm text-red-700 dark:text-red-400"
          >
            {state.fieldErrors.serviceLocationId}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="categoryId" className="text-sm font-semibold">
          Category
        </label>
        <select
          key={selectedDepartmentId}
          id="categoryId"
          name="categoryId"
          defaultValue={state.values.categoryId}
          disabled={!selectedDepartmentId}
          required
          aria-describedby="categoryId-help"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800"
        >
          <option value="">
            {selectedDepartmentId
              ? "Select a category"
              : "Choose a help area first"}
          </option>
          {filteredCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <p
          id="categoryId-help"
          className="text-sm text-slate-500 dark:text-slate-400"
        >
          Categories update after you choose a help area above.
        </p>
        {state.fieldErrors.categoryId && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.fieldErrors.categoryId}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="subject" className="text-sm font-semibold">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          defaultValue={state.values.subject}
          maxLength={200}
          required
          aria-describedby={
            state.fieldErrors.subject ? "subject-error" : undefined
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="Short summary, e.g. Chromebook won't turn on"
        />
        {state.fieldErrors.subject && (
          <p
            id="subject-error"
            role="alert"
            className="text-sm text-red-700 dark:text-red-400"
          >
            {state.fieldErrors.subject}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="description" className="text-sm font-semibold">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={state.values.description}
          maxLength={4000}
          required
          rows={5}
          aria-describedby={
            state.fieldErrors.description ? "description-error" : undefined
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="What's happening? Include anything that will help us assist you."
        />
        {state.fieldErrors.description && (
          <p
            id="description-error"
            role="alert"
            className="text-sm text-red-700 dark:text-red-400"
          >
            {state.fieldErrors.description}
          </p>
        )}
      </div>

      <p className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        Please don&apos;t include passwords, Social Security numbers, medical
        information, or other highly sensitive information in your request.
      </p>

      {state.formError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.formError}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
    >
      {pending ? "Submitting request…" : "Submit Request"}
    </button>
  );
}
