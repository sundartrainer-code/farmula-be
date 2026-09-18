import { prisma } from "../config/prisma.js"

export const userRepository = {
  async upsertFirebaseUser({ firebaseUid, email, displayName, photoURL }) {
    const userByFirebaseUid = await prisma.user.findUnique({ where: { firebaseUid } })

    if (userByFirebaseUid) {
      return prisma.user.update({
        where: { id: userByFirebaseUid.id },
        data: {
          email,
          displayName,
          photoURL,
        },
      })
    }

    if (email) {
      const userByEmail = await prisma.user.findUnique({ where: { email } })

      if (userByEmail) {
        return prisma.user.update({
          where: { id: userByEmail.id },
          data: {
            firebaseUid,
            displayName,
            photoURL,
          },
        })
      }
    }

    return prisma.user.create({
      data: {
        firebaseUid,
        email,
        displayName,
        photoURL,
        role: "student",
      },
    })
  },
  findById(id) {
    return prisma.user.findUnique({ where: { id } })
  },
  findMany() {
    return prisma.user.findMany({ orderBy: { createdAt: "desc" } })
  },
}
