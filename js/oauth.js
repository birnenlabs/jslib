const oauthStateParam = 'state';
const oauthCodeParam = 'code';

/**
 * @typedef {Object} AccessToken
 * @property {string} code
 * @property {string} client_id
 * @property {string} client_secret
 * @property {URL} redirect_uri
 * @property {'authorization_code'} grant_type
 */

/**
 * @typedef {Object} RefreshToken
 * @property {string} client_id
 * @property {string} client_secret
 * @property {string} refresh_token
 * @property {'refresh_token'} grant_type
 */

/**
 * Helper method that should be invoked in the oauth redirect window.
 * The popup page needs to specify OAuthSettings name in 'state' get parameter.
 * This method will:
 *   - load the OAuthSettings
 *   - parse the returned oauth code from the url
 *   - request refresh token and save it in OAuthSettings
 *   - redirect back to the return url
 *
 * @return {Promise<void>}
 */
export function processOAuthRedirect() {
  const url = new URL(window.location.href);
  const name = url.searchParams.get(oauthStateParam);
  if (!name) {
    return Promise.reject(new Error(`Url missing param: ${oauthStateParam}`));
  }

  const s = new OAuthSettings(name);
  if (!s.isInitialised()) {
    return Promise.reject(new Error(`Settings ${s} should be initialised in processOAuthRedirect`));
  }

  const code = url.searchParams.get(oauthCodeParam);
  if (!code) {
    return Promise.reject(new Error(`Url missing param: ${oauthCodeParam}`));
  }

  /** @type {RequestInit} */
  const params = {method: 'POST', mode: 'cors', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(s.createRefreshTokenData(code))};

  return fetch(s.getTokenUrl(), params)
      .then((response) => {
        if (response.status != 200) {
          throw new Error(`Cannot get token: url: ${s.getTokenUrl()}, response: ${response.status}`);
        }
        return response.json();
      })
      .then((json) => {
        if (!json.refresh_token) {
          throw new Error(`RefreshToken not found in response: ${json}`);
        }
        s.setRefreshToken(json.refresh_token);
        s.save();
        if (s.getReturnUrl()) {
          window.location.href = s.getReturnUrl();
        }
        return;
      });
}


/**
 * OAuth class that will take care of the OAuth flow.
 * If OAuthSettings are properly configured, it will return
 * the token after calling getAccessToken() method.
 */
export class OAuth {
  #settings;
  #accessToken;

  /**
   * @param {OAuthSettings} settings
   */
  constructor(settings) {
    console.log('OAuth created');
    this.#settings = settings;
  }

  /**
   * @param {boolean} forceRefresh
   * @return {Promise<string>}
   */
  getAccessToken(forceRefresh = false) {
    if (!this.#settings.hasRefreshToken()) {
      return Promise.reject(new Error('Missing token - Access not granted, please initialise OAuth'));
    }

    if (forceRefresh) {
      this.#accessToken = undefined;
    }
    if (this.#accessToken) {
      return Promise.resolve(this.#accessToken);
    }

    const accessTokenData = this.#settings.createAccessTokenData();
    if (!accessTokenData) {
      return Promise.reject(new Error(`Settings not initialised: ${this.#settings}`));
    }

    /** @type {RequestInit} */
    const params = {method: 'POST', mode: 'cors', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(accessTokenData)};
    return fetch(this.#settings.getTokenUrl(), params)
        .then((response) => (response.status == 200) ? response :
           // @ts-ignore
           /** @type {Response} */(this.#throwError(`Cannot get access token: url: ${this.#settings.getTokenUrl()}, response: ${response.status}`, true)))
        .then((response) => response.json())
        .then((json) => json.access_token ? (this.#accessToken = json.access_token) : this.#throwError(`AccessToken not found in response: ${json}`, false));
  }

  /**
   * @param {string} message
   * @param {boolean} openOAuthPopup
   */
  #throwError(message, openOAuthPopup) {
    console.error(message);
    console.error('Removing RefreshToken.');
    this.#settings.setRefreshToken('');
    this.#settings.save();
    if (openOAuthPopup) {
      this.#openOAuthPopup();
    }
    throw new Error(message);
  }
}

/**
 * Class that contains OAuthSettings.
 * It will load and save the settings from the local storage under the specified #name.
 * To see which parameters are required please check isInitialised() method.
 */
export class OAuthSettings {
  static #type = 'OAuthSettings';
  #name;
  #data;

  /**
   * @param {string} name
   */
  constructor(name) {
    this.#name = name;
    this.#data = JSON.parse(localStorage.getItem(name) || 'null') || {type: OAuthSettings.#type};
    if (OAuthSettings.#type == this.#data.type) {
      console.log('OAuthSettings created: ' + this);
    } else {
      console.warn('OAuthSettings created [saved data contains invalid type]: ' + this);
    }
  }

  /**
   * @return {URL|undefined}
   */
  createOAuthUrl() {
    if (!this.isInitialised()) {
      return undefined;
    }

    const redirectUrl = new URL(this.#data.redirectUrl);

    const oAuthUrl = new URL(this.#data.oAuthUrl);
    oAuthUrl.searchParams.set('client_id', this.#data.clientId);
    oAuthUrl.searchParams.set(oauthStateParam, this.#name);
    oAuthUrl.searchParams.set('redirect_uri', redirectUrl.toString());
    oAuthUrl.searchParams.set('scope', this.#data.scope);
    oAuthUrl.searchParams.set('response_type', 'code');
    oAuthUrl.searchParams.set('access_type', 'offline');
    oAuthUrl.searchParams.set('approval_prompt', 'force');
    return oAuthUrl;
  }

  /**
   * @param {string} code
   * @return {AccessToken|undefined}
   */
  createRefreshTokenData(code) {
    if (!this.isInitialised()) {
      return undefined;
    }

    return {
      code: code,
      client_id: this.#data.clientId,
      client_secret: this.#data.clientSecret,
      redirect_uri: this.#data.redirectUrl,
      grant_type: 'authorization_code',
    };
  }

  /**
   * @return {RefreshToken|undefined}
   */
  createAccessTokenData() {
    if (!this.isInitialised() || !this.#data.refreshToken) {
      return undefined;
    }

    return {
      client_id: this.#data.clientId,
      client_secret: this.#data.clientSecret,
      refresh_token: this.#data.refreshToken,
      grant_type: 'refresh_token',
    };
  }

  /**
   * Save to storage
   */
  save() {
    localStorage.setItem(this.#name, JSON.stringify(this.#data));
    console.log('OAuthSettings saved: ' + this);
  }

  /**
   * @return {string}
   */
  getName() {
    return this.#name;
  }

  /**
   * @return {string}
   */
  getTokenUrl() {
    return this.#data.tokenUrl;
  }

  /**
   * @return {string}
   */
  getClientId() {
    return this.#data.clientId;
  }

  /**
   * @return {string}
   */
  getClientSecret() {
    return this.#data.clientSecret;
  }

 /**
   * @return {string}
   */
  getReturnUrl(url) {
    return this.#data.url;
  }

  /**
   * @return {boolean}
   */
  hasRefreshToken() {
    return true && this.#data.refreshToken;
  }


  /**
   * Sets client id (e.g. from Google Developer Console)
   *
   * @param {string} clientId
   */
  setClientId(clientId) {
    this.#data.clientId = clientId;
  }

  /**
   * Sets client secret (e.g. from Google Developer Console)
   *
   * @param {string} clientSecret
   */
  setClientSecret(clientSecret) {
    this.#data.clientSecret = clientSecret;
  }

  /**
   * Sets requested scope
   *
   * @param {string} scope
   */
  setScope(scope) {
    this.#data.scope = scope;
  }

  /**
   * Sets url to obtain initial refresh token, e.g.: https://accounts.google.com/o/oauth2/auth
   *
   * @param {string} oAuthUrl
   */
  setOAuthUrl(oAuthUrl) {
    this.#data.oAuthUrl = oAuthUrl;
  }

  /**
   * Sets url to refresh token, e.g.: https://accounts.google.com/o/oauth2/token
   *
   * @param {string} tokenUrl
   */
  setTokenUrl(tokenUrl) {
    this.#data.tokenUrl = tokenUrl;
  }

  /**
   * Sets redirect url - usually url of the page - for this page use https://birnenlabs.com/oauth/popup.html
   *
   * @param {string} redirectUrl
   */
  setRedirectUrl(redirectUrl) {
    this.#data.redirectUrl = redirectUrl;
  }

  /**
   * Sets refresh token for updating access token
   *
   * @param {string} refreshToken
   */
  setRefreshToken(refreshToken) {
    this.#data.refreshToken = refreshToken;
  }

  /**
   * Sets the optional return url. It will be used to redirect
   * the user back after oAuth flow.
   *
   * @param {string} url
   */
  setReturnUrl(url) {
    this.#data.url = url;
  }

  /**
   * @return {boolean}
   */
  isInitialised() {
    return this.#data.clientId &&
        this.#data.clientSecret &&
        this.#data.scope &&
        this.#data.oAuthUrl &&
        this.#data.tokenUrl &&
        this.#data.redirectUrl;
  }

  /**
   * @return {string}
   */
  toString() {
    return `OAuthSettings[name=${this.#name}, data=[clientId=${this.#data.clientId}, clientSecret=${this.#data.clientSecret}, type=${this.#data.type}, scope=${this.#data.scope}, oAuthUrl=${this.#data.oAuthUrl}, tokenUrl=${this.#data.tokenUrl}, redirectUrl=${this.#data.redirectUrl}, refreshToken=${this.#data.refreshToken}]]`;
  }
}
