import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      dbUrl: string;
      dbAuthToken: string;
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
