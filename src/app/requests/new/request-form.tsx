"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createTicketAction,
  EMPTY_CREATE_TICKET_VALUES,
  type CreateTicketFormState,
} from "./actions";

export interface RequestFormDepartment {
  id: string;
  code: string;
  name: string;
}

export interface RequestFormCategory {
  id: string;
  departmentId: string;
  name: string;
}

export interface RequestFormLocation {
  id: string;
  name: string;
}

const INITIAL_STATE: CreateTicketFormState = {
  status: "idle",
  fieldErrors: {},
  values: EMPTY_CREATE_TICKET_VALUES,
};

export function RequestForm({
  departments,
  categories,
  serviceLocations,
}: {
  departments: RequestFormDepartment[];
  categories: RequestFormCategory[];
  serviceLocations: RequestFormLocation[];
}) {
  const [state, formAction] = useActionState(createTicketAction, INITIAL_STATE);
  // Uncontrolled fields (defaultValue/defaultChecked) already preserve
  // whatever the requester typed across a failed submission, since the
  // form doesn't unmount between attempts. This local state exists only
  // to drive the department -> category filter live, as the requester
  // interacts, before any server round-trip.
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
