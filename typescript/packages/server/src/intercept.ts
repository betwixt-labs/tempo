import { ServerContext } from './context';
import { AuthContext } from './auth';

/**
 * Abstract class representing an authentication interceptor.
 * This class should be extended to implement custom authentication logic.
 * The `intercept` method is called to authenticate incoming server requests.
 */
export abstract class AuthInterceptor {
	/**
	 * Intercepts and processes the incoming server request for authentication.
	 * This method should be overridden to implement custom authentication logic.
	 * @param context The ServerContext representing the incoming request.
	 * @param authorizationValue The value of the Authorization header from the incoming request.
	 * @returns A Promise resolving to an AuthContext (representing the authentication state of the request) or undefined if the request is not authenticated.
	 */
	public abstract intercept(context: ServerContext, authorizationValue: string): Promise<AuthContext | undefined>;
}
