"use client";

import { useActionState } from "react";
import { saveProfileAction, type FormResult } from "@/app/actions/profile";
import { careerInterestOptions } from "@/contracts/profile";

const initialState: FormResult = { error: null };

export function ProfileForm({
  programme = "",
  level = "",
  careerInterests = [],
  submitLabel = "Continue",
}: {
  programme?: string;
  level?: string;
  careerInterests?: string[];
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(saveProfileAction, initialState);

  return (
    <form action={formAction} className="form-stack">
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
        <select name="level" defaultValue={level || "100 Level"} required>
          {[100, 200, 300, 400, 500, 600].map((n) => <option key={n}>{n} Level</option>)}
          <option>Other</option>
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
