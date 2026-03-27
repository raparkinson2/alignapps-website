import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/app/schedule';

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if this user has an existing player record
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: players } = await supabase
          .from('players')
          .select('id')
          .eq('email', user.email.toLowerCase())
          .limit(1);

        if (!players || players.length === 0) {
          // No account found — sign them out and redirect to a friendly page
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/no-account`);
        }

        // Link this Supabase user ID to the player record so future
        // OAuth logins (e.g. Sign in with Apple) can be found by auth_user_id
        if (players[0]?.id) {
          await supabase
            .from('players')
            .update({ auth_user_id: user.id })
            .eq('id', players[0].id);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
