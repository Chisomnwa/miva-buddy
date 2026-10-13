"use client";

import { useActionState } from "react";
import { saveProfileAction, type FormResult } from "@/app/actions/profile";
import { careerInterestOptions, getStudentLevelDefault, studentLevelOptions } from "@/contracts/profile";

const initialState: FormResult = { error: null };

export function ProfileForm({
  programme = "",
  level = "",
  careerInterests = [],
  submitLabel = "Continue",
  saveContext = "onboarding",
}: {
  programme?: string;
  level?: string;
  careerInterests?: string[];
  submitLabel?: string;
  saveContext?: "onboarding" | "profile";
}) {
  const [state, formAction, pending] = useActionState(saveProfileAction, initialState);

  return (
    <form action={formAction} className="form-stack">
      <input type="hidden" name="saveContext" value={saveContext} />
      {saveContext === "profile" && <p className="form-intro">Your study area, level, and interests help tailor examples and keep relevant learning paths easy to find.</p>}
      <label className="field">
        <span>What are you studying?</span>
        <select name="programme" defaultValue={programme || "Computer Science"} required>
          <option>Computer Science</option>
          <option>Software Engineering</option>
          <option>Information Technology</option>
          <option>Other</option>
        </select>
      </label>
      <label className="field">
        <span>What level are you currently in?</span>
        <select name="level" defaultValue={getStudentLevelDefault(level)} required>
          {level && !studentLevelOptions.some((option) => option === level) && (
            <option value="" disabled>Choose a current level to update your saved profile</option>
          )}
          {studentLevelOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <fieldset className="interest-fieldset">
        <legend>What are you interested in?</legend>
        <div className="interest-list">
          {careerInterestOptions.map((interest) => (
            <label className="interest-option" key={interest}>
              <input
                defaultChecked={careerInterests.includes(interest)}
                name="careerInterests"
                type="checkbox"
                value={interest}
              />
              <span>{interest}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="button button-primary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
