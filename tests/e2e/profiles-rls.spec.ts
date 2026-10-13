import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test("legacy anonymous-user RLS journey (superseded by permanent-auth policy)", async ({}, testInfo) => {
  test.skip(true, "This test creates anonymous identities. Use a permanent-user fixture plus an anonymous-denial test for the Google-auth beta.");
  test.skip(process.env.RUN_HOSTED_SUPABASE_TESTS !== "1", "Set RUN_HOSTED_SUPABASE_TESTS=1 to create hosted anonymous users and run the RLS check.");
  test.skip(testInfo.project.name !== "chromium", "Run the hosted RLS check once, not once per browser project.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  test.skip(!url || !key, "Requires a configured Supabase project.");

  const studentA = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  const studentB = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: a, error: authErrorA } = await studentA.auth.signInAnonymously();
  expect(authErrorA).toBeNull();
  expect(a.user).not.toBeNull();
  const { data: b, error: authErrorB } = await studentB.auth.signInAnonymously();
  expect(authErrorB).toBeNull();
  expect(b.user).not.toBeNull();
  expect(a.user!.id).not.toBe(b.user!.id);

  const profile = {
    user_id: a.user!.id,
    programme: "Computer Science",
    level: "200 Level",
    career_interests: ["Software Engineering"],
  };

  const { error: insertError } = await studentA.from("profiles").insert(profile);
  expect(insertError).toBeNull();

  const { data: hiddenRows, error: readError } = await studentB
    .from("profiles")
    .select("user_id")
    .eq("user_id", a.user!.id);
  expect(readError).toBeNull();
  expect(hiddenRows).toEqual([]);

  const { error: forgedInsertError } = await studentB.from("profiles").insert(profile);
  expect(forgedInsertError).not.toBeNull();

  const { error: cleanupError } = await studentA.from("profiles").delete().eq("user_id", a.user!.id);
  expect(cleanupError).toBeNull();

  const { data: conversation, error: conversationError } = await studentA
    .from("learn_conversations")
    .insert({ user_id: a.user!.id, title: "M2 RLS verification fixture" })
    .select("id")
    .single();
  expect(conversationError).toBeNull();
  expect(conversation).not.toBeNull();

  const { data: hiddenConversations, error: hiddenConversationError } = await studentB
    .from("learn_conversations")
    .select("id")
    .eq("id", conversation!.id);
  expect(hiddenConversationError).toBeNull();
  expect(hiddenConversations).toEqual([]);

  const { error: forgedConversationError } = await studentB.from("learn_conversations").insert({
    user_id: a.user!.id,
    title: "M2 forged ownership fixture",
  });
  expect(forgedConversationError).not.toBeNull();
});
