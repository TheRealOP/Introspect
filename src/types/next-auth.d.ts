import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  // Note: dbUrl / dbAuthToken are intentionally NOT on Session — they live in
  // the JWT only and are read via getUserDbCredentials() (see audit H1).
  interface Session {
    user: {
      id: string;
      email: string;
    };
  }
  interface User {
    dbUrl: string;
    dbAuthToken: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    dbUrl: string;
    dbAuthToken: string;
  }
}
