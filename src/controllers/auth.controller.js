export const authController = {
  me(req, res) {
    res.json({ user: req.user })
  },
  logout(_req, res) {
    res.json({ message: "Logged out" })
  },
}
