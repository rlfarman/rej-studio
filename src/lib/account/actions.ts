/**
 * The auth client, loaded when someone signs in or out rather than with
 * every page (it is most of what accounts add to the browser's download).
 * Opening the sign-in dialog starts the download, so it is usually there
 * by the time the person has typed their address.
 */
export const loadAuthClient = () => import('./auth-client')
