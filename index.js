const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

async function run() {
  try {
    await client.connect();
    const db = client.db("hobbyhub");
    const groups = db.collection("groups");

    app.post("/api/create-group", async (req, res) => {
      const group = req.body;
      const result = await groups.insertOne(group);
      res.send(result);
    });

    app.get("/api/groups", async (req, res) => {
      const result = await groups.find().toArray();
      res.send(result);
    });

    app.get("/api/featured-groups", async (req, res) => {
      const result = await groups.find({ isFeatured: true }).limit(6).toArray();
      res.send(result);
    });

    app.get("/api/my-groups", async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).send({ error: "Email required" });
      const result = await groups.find({ "createdBy.email": email }).toArray();
      res.send(result);
    });

    app.get("/api/joined-groups", async (req, res) => {
      const email = req.query.email;
      if (!email) return res.status(400).send({ error: "Email required" });
      const result = await groups.find({ "joinedMembers.email": email }).toArray();
      res.send(result);
    });

    app.get("/api/group/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const group = await groups.findOne({ _id: new ObjectId(id) });
        if (!group) return res.status(404).send({ error: "Group not found" });
        res.send(group);
      } catch (err) {
        res.status(500).send({ error: "Invalid group ID" });
      }
    });

    app.patch("/api/group/leave/:id", async (req, res) => {
      const groupId = req.params.id;
      const { email } = req.body;

      try {
        const result = await groups.updateOne(
          { _id: new ObjectId(groupId) },
          { $pull: { joinedMembers: { email } } }
        );

        res.send(result);
      } catch (err) {
        console.error("Leave group error:", err);
        res.status(500).send({ error: "Failed to leave group" });
      }
    });

    app.put("/api/group/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid group ID" });
        }

        const result = await groups.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        res.send(result);
      } catch (error) {
        console.error("Update error:", error);
        res.status(500).send({ error: "Failed to update group." });
      }
    });

    app.patch("/api/group/join/:id", async (req, res) => {
      const groupId = req.params.id;
      const { email, avatar } = req.body;

      try {
        const group = await groups.findOne({ _id: new ObjectId(groupId) });
        if (!group) return res.status(404).send({ error: "Group not found" });

        const alreadyJoined = group.joinedMembers?.some(member => member.email === email);
        if (alreadyJoined) return res.status(400).send({ error: "Already joined" });

        const total = group.joinedMembers?.length || 0;
        if (total >= parseInt(group.maxMembers)) {
          return res.status(400).send({ error: "Group is full" });
        }

        const updated = await groups.updateOne(
          { _id: new ObjectId(groupId) },
          { $push: { joinedMembers: { email, avatar } } }
        );

        res.send(updated);
      } catch (error) {
        console.error("Join error:", error);
        res.status(500).send({ error: "Server error" });
      }
    });

    app.delete("/api/group/:id", async (req, res) => {
      const id = req.params.id;
      const result = await groups.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    await groups.updateMany(
      { joinedMembers: { $exists: false } },
      { $set: { joinedMembers: [] } }
    );
    console.log("✅ Initialized missing joinedMembers fields.");
  } catch (error) {
    console.error("❌ Server Error:", error);
  }
}

run();

app.get("/", (req, res) => {
  res.send("🚀 HobbyHub Server is running!");
});

app.listen(port, () => {
  console.log(`✅ Server listening on port ${port}`);
});
