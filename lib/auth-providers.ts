import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

// Configure web browser for OAuth redirect
WebBrowser.maybeCompleteAuthSession();

export async function signInWithApple() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('No identity token returned from Apple');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    if (error instanceof AppleAuthentication.AppleAuthenticationMissingResponseError) {
      throw new Error('Apple sign-in was cancelled');
    } else if (error instanceof AppleAuthentication.AppleAuthenticationNotAvailableError) {
      throw new Error('Apple sign-in is not available on this device');
    }
    throw error;
  }
}

export async function signInWithGoogle() {
  try {
    const redirectUrl = AuthSession.makeRedirectUri({
      scheme: 'formeapp',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');

    // Open in web browser
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectUrl,
      {
        showInRecents: true,
      }
    );

    if (result.type !== 'success') {
      throw new Error('Google sign-in was cancelled');
    }

    // The session will be set automatically by Supabase listener
    return { session: null };
  } catch (error) {
    throw error;
  }
}
