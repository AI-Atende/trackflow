import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const email = "douglas@aiatende.com.br"; // Corrigido typo (..) para (.)
    const password = "admin1234";
    const name = "Douglas Augusto";

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.client.upsert({
        where: { email },
        update: {
            passwordHash,
            role: "ADMIN",
            isActive: true,
        },
        create: {
            email,
            name,
            passwordHash,
            role: "ADMIN",
            isActive: true,
        },
    });

    console.log({ user });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
