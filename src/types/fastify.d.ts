import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    githubOAuth2: {
      generateAuthorizationUri: (opts?: { scope?: string[]; state?: string }) => Promise<string>;
      getAccessTokenFromAuthorizationCodeFlow: (opts: { code: string }) => Promise<{ token: { access_token: string } }>;
    };
    googleOAuth2: {
      generateAuthorizationUri: (opts?: { scope?: string[]; state?: string }) => Promise<string>;
      getAccessTokenFromAuthorizationCodeFlow: (opts: { code: string }) => Promise<{ token: { access_token: string } }>;
    };
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}