import {
  ConfidentialClientApplication,
  CryptoProvider,
  ResponseMode,
  type Configuration,
  type AuthorizationUrlRequest,
  type AuthorizationCodeRequest,
  type AuthorizationCodePayload,
  InteractionRequiredAuthError,
  type ICachePlugin,
  type TokenCacheContext,
} from "@azure/msal-node";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createSession } from "./session";
import path from "node:path";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  CLOUD_INSTANCE,
  REDIRECT_URI,
  TENANT_ID,
} from "./env";

const cachePath = path.join("./token-cache.json");

class DiskCachePlugin implements ICachePlugin {
  public async beforeCacheAccess(
    cacheContext: TokenCacheContext,
  ): Promise<void> {
    if (existsSync(cachePath)) {
      const cacheData = readFileSync(cachePath, "utf8");
      cacheContext.tokenCache.deserialize(cacheData); // deserialize it to in-memory cache
    }
  }

  public async afterCacheAccess(
    cacheContext: TokenCacheContext,
  ): Promise<void> {
    if (cacheContext.cacheHasChanged) {
      writeFileSync(cachePath, cacheContext.tokenCache.serialize()); // deserialize in-memory cache to persistence
    }
  }
}

const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID, // 'Application (client) ID' of app registration in Azure portal - this value is a GUID
    authority: CLOUD_INSTANCE + TENANT_ID, // Full directory URL, in the form of https://login.microsoftonline.com/<tenant>
    clientSecret: CLIENT_SECRET, // Client secret generated from the app registration in Azure portal
  },
  cache: {
    cachePlugin: new DiskCachePlugin(),
  },
};

class AuthProvider {
  msalConfig: Configuration;
  cryptoProvider: CryptoProvider;
  cca: ConfidentialClientApplication;

  constructor(msalConfig: Configuration) {
    this.msalConfig = msalConfig;
    this.cryptoProvider = new CryptoProvider();
    this.cca = new ConfidentialClientApplication(msalConfig);
  }

  async login(options: {
    successRedirect: string;
    scopes: string[];
    extraScopesToConsent?: string[];
  }) {
    /**
     * MSAL Node library allows you to pass your custom state as state parameter in the Request object.
     * The state parameter can also be used to encode information of the app's state before redirect.
     * You can pass the user's state in the app, such as the page or view they were on, as input to this parameter.
     */
    const state = this.cryptoProvider.base64Encode(
      JSON.stringify({
        successRedirect: options.successRedirect,
      }),
    );

    const authCodeUrlRequestParams: AuthorizationUrlRequest = {
      state,
      /**
       * By default, MSAL Node will add OIDC scopes to the auth code url request. For more information, visit:
       * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
       */
      scopes: options.scopes,
      extraScopesToConsent: options.extraScopesToConsent,
      redirectUri: REDIRECT_URI,
    };

    /**
     * If the current msal configuration does not have cloudDiscoveryMetadata or authorityMetadata, we will
     * make a request to the relevant endpoints to retrieve the metadata. This allows MSAL to avoid making
     * metadata discovery calls, thereby improving performance of token acquisition process. For more, see:
     * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/performance.md
     */
    if (
      !this.msalConfig.auth.cloudDiscoveryMetadata ||
      !this.msalConfig.auth.authorityMetadata
    ) {
      const [cloudDiscoveryMetadata, authorityMetadata] = await Promise.all([
        this.getCloudDiscoveryMetadata(this.msalConfig.auth.authority),
        this.getAuthorityMetadata(this.msalConfig.auth.authority),
      ]);

      this.msalConfig.auth.cloudDiscoveryMetadata = JSON.stringify(
        cloudDiscoveryMetadata,
      );
      this.msalConfig.auth.authorityMetadata =
        JSON.stringify(authorityMetadata);
    }

    const msalInstance = this.cca;

    // trigger the first leg of auth code flow
    await this.redirectToAuthCodeUrl(authCodeUrlRequestParams, msalInstance);
  }

  async acquireToken(options: {
    homeAccountId: string;
    scopes: string[];
    successRedirect: string;
  }): Promise<string> {
    try {
      /**
       * If a token cache exists in the session, deserialize it and set it as the
       * cache for the new MSAL CCA instance. For more, see:
       * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/caching.md
       */
      const msalInstance = this.cca;
      const homeAccountId = options.homeAccountId;

      const msalTokenCache = msalInstance.getTokenCache();
      const account = await msalTokenCache.getAccountByHomeId(homeAccountId);

      if (account === null) {
        // TODO: Proper error handling
        throw new Error("Account not found");
      }

      const tokenResponse = await msalInstance.acquireTokenSilent({
        account: account,
        scopes: options.scopes,
      });

      /**
       * On successful token acquisition, write the updated token
       * cache back to the session. For more, see:
       * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/caching.md
       */
      // if (tokenResponse.account?.homeAccountId)
      //   await createSession(tokenResponse.account?.homeAccountId);

      return tokenResponse.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        await this.login({
          scopes: options.scopes,
          successRedirect: options.successRedirect,
        });
      }
      throw error;
    }
  }

  async handleRedirect(
    request: NextRequest,
    options: { scopes: string[]; redirectUri: string },
  ) {
    const textBody = await request.text();
    const params = new URLSearchParams(textBody);
    const reqState = params.get("state");
    const code = params.get("code");

    if (reqState === null) {
      return NextResponse.json(
        // TODO: improve error handling
        { error: "Error: state not found" },
        { status: 500 },
      );
    }

    if (typeof code !== "string") {
      return NextResponse.json(
        // TODO: improve error handling
        { error: "Error: code not found" },
        { status: 500 },
      );
    }

    const cookieStore = await cookies();
    const verifier = cookieStore.get("verifier")?.value;

    const authCodeRequest: AuthorizationCodeRequest = {
      state: reqState,
      /**
       * By default, MSAL Node will add OIDC scopes to the auth code url request. For more information, visit:
       * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
       */
      scopes: options.scopes || [],
      redirectUri: options.redirectUri,
      code,
      codeVerifier: verifier,
    };

    let state: { successRedirect: string } | null = null;
    try {
      const msalInstance = this.cca;

      const cachedState = cookieStore.get("state")?.value;
      const authCodePayload: AuthorizationCodePayload = {
        code,
        state: cachedState,
      };

      const tokenResponse = await msalInstance.acquireTokenByCode(
        authCodeRequest,
        authCodePayload,
      );

      if (tokenResponse.account?.homeAccountId) {
        await createSession(tokenResponse.account?.homeAccountId);
      }

      state = JSON.parse(this.cryptoProvider.base64Decode(reqState));
    } catch (error) {
      // TODO: improve error handling
      console.log(error);
    }

    if (state !== null) {
      redirect(state.successRedirect);
    }
  }

  async logout(postLogoutRedirectUri?: string) {
    const cookieStore = await cookies();

    /**
     * Construct a logout URI and redirect the user to end the
     * session with Azure AD. For more information, visit:
     * https://docs.microsoft.com/azure/active-directory/develop/v2-protocols-oidc#send-a-sign-out-request
     */
    let logoutUri = `${this.msalConfig.auth.authority}/oauth2/v2.0/`;

    if (postLogoutRedirectUri) {
      logoutUri += `logout?post_logout_redirect_uri=${postLogoutRedirectUri}`;
    }

    cookieStore.delete("session");

    NextResponse.redirect(logoutUri);
  }

  /**
   * Prepares the auth code request parameters and initiates the first leg of auth code flow
   * @param authCodeUrlRequestParams: parameters for requesting an auth code url
   * @param authCodeRequestParams: parameters for requesting tokens using auth code
   */
  async redirectToAuthCodeUrl(
    authCodeUrlRequestParams: AuthorizationUrlRequest,
    msalInstance: ConfidentialClientApplication,
  ) {
    // Generate PKCE Codes before starting the authorization flow
    const { verifier, challenge } =
      await this.cryptoProvider.generatePkceCodes();

    // Set generated PKCE codes
    const cookieStore = await cookies();
    /*
     * PKCE は主に Public Client で使用される技術だが Confidential Client でも使用されることが推奨されている
     * https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics#section-2.1.1-2.2
     */
    cookieStore.set("verifier", verifier);
    if (authCodeUrlRequestParams.state) {
      /*
       * PKCE を使用する場合は state を使用しないことも許されている
       * しかし PKCE の実装を間違えたときのための追加の保険やアプリケーション状態を運搬するために
       * state も併用することがあるらしい
       * https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics-13#section-3.1
       */
      cookieStore.set("state", authCodeUrlRequestParams.state);
    }
    cookieStore.set("redirectUri", authCodeUrlRequestParams.redirectUri);
    cookieStore.set("scopes", JSON.stringify(authCodeUrlRequestParams.scopes));

    const authCodeUrlRequest: AuthorizationUrlRequest = {
      ...authCodeUrlRequestParams,
      responseMode: ResponseMode.FORM_POST,
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
    };

    let authCodeUrlResponse: string | null = null;

    try {
      authCodeUrlResponse =
        await msalInstance.getAuthCodeUrl(authCodeUrlRequest);
    } catch (error) {
      // TODO: improve error handling
      console.error(error);
    }

    if (authCodeUrlResponse !== null) {
      redirect(authCodeUrlResponse);
    } else {
      return NextResponse.json(
        { error: "Failed to get Authorization Code Url" },
        { status: 500 },
      );
    }
  }

  /**
   * Retrieves cloud discovery metadata from the /discovery/instance endpoint
   */
  async getCloudDiscoveryMetadata(
    authority: string = `https://login.microsoftonline.com/${TENANT_ID}`,
  ) {
    const endpoint =
      "https://login.microsoftonline.com/common/discovery/instance";

    try {
      const url = new URL(endpoint);
      url.search = new URLSearchParams({
        "api-version": "1.1",
        authorization_endpoint: `${authority}/oauth2/v2.0/authorize`,
      }).toString();

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retrieves oidc metadata from the openid endpoint
   */
  async getAuthorityMetadata(
    authority: string = `https://login.microsoftonline.com/${TENANT_ID}`,
  ) {
    const endpoint = `${authority}/v2.0/.well-known/openid-configuration`;

    try {
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.log(error);
    }
  }
}

export const authProvider = new AuthProvider(msalConfig);
