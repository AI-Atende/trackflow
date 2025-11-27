import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const client = await prisma.client.findUnique({
                    where: { email: credentials.email },
                    include: { metaAdAccount: true }, // Incluir conta de anúncios
                });

                if (!client) {
                    return null;
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password,
                    client.passwordHash
                );

                if (!isPasswordValid) {
                    return null;
                }

                if (!client.isActive) {
                    throw new Error("Usuário inativo.");
                }

                return {
                    id: client.id,
                    clientId: client.id,
                    email: client.email,
                    name: client.name,
                    role: client.role,
                    isActive: client.isActive,
                    image: client.image,
                    metaAdAccount: client.metaAdAccount ? {
                        id: client.metaAdAccount.id,
                        adAccountId: client.metaAdAccount.adAccountId,
                        name: client.metaAdAccount.name,
                        status: client.metaAdAccount.status,
                    } : null,
                } as any;
            },
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 dias
    },
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.clientId = user.clientId;
                token.role = user.role;
                token.isActive = user.isActive;
                token.image = user.image;
                token.metaAdAccount = user.metaAdAccount;
            }

            // Se o token já existe (usuário logado), buscar dados atualizados do banco
            if (token.clientId) {
                const dbUser = await prisma.client.findUnique({
                    where: { id: token.clientId },
                    include: { metaAdAccount: true },
                });

                if (dbUser) {
                    token.metaAdAccount = dbUser.metaAdAccount ? {
                        id: dbUser.metaAdAccount.id,
                        adAccountId: dbUser.metaAdAccount.adAccountId,
                        name: dbUser.metaAdAccount.name || "",
                        status: dbUser.metaAdAccount.status,
                    } : null;
                    token.role = dbUser.role;
                    token.isActive = dbUser.isActive;
                    token.image = dbUser.image;
                }
            }

            // Permitir atualização da sessão via client-side (ex: update({ image: ... }))
            if (trigger === "update" && session?.image) {
                token.image = session.image;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.clientId = token.clientId;
                session.user.role = token.role;
                session.user.isActive = token.isActive;
                session.user.image = token.image;
                session.user.metaAdAccount = token.metaAdAccount;
            }
            return session;
        },
    },
    pages: {
        signIn: "/auth/login",
    },
};
