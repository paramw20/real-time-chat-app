import React, { useEffect, useState } from "react";
import "./chat.css";
import EmojiPicker from "emoji-picker-react";
import {
  arrayUnion,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import upload from "../../lib/upload";
import { format } from "timeago.js";

const Chat = () => {
  const [chat, setChat] = useState(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [img, setImg] = useState({
    file: null,
    url: "",
  });
  const [onlineStatus, setOnlineStatus] = useState(false); // Add state for online status

  const { currentUser } = useUserStore();
  const { chatId, user, isCurrentUserBlocked, isReceiverBlocked } = useChatStore();

  const endRef = React.createRef(null);

  useEffect(() => {
    if (chatId) {
      const unSub = onSnapshot(doc(db, "chats", chatId), async (res) => {
        const updatedChat = res.data();
        if (updatedChat && updatedChat.messages) {
          const userChatsRef = doc(db, "userchats", user.id);
          const userChatsSnapshot = await getDoc(userChatsRef);
          const userChatsData = userChatsSnapshot.data();
          
          updatedChat.messages.forEach(message => {
            if (message.senderId !== currentUser.id) {
              message.isRead = true;
            }
          });
          
          // Update chat data in Firestore
          await updateDoc(userChatsRef, {
            chats: userChatsData.chats.map((c) =>
              c.chatId === chatId ? { ...c, isSeen: true } : c
            ),
          });

          await updateDoc(doc(db, "chats", chatId), updatedChat);
        }
        setChat(updatedChat);
      });

      // Fetch online status of the user
      const userRef = doc(db, "users", user.id);
      const statusUnsub = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          const userData = doc.data();
          setOnlineStatus(userData.online || false);
        } else {
          setOnlineStatus(false); // Set onlineStatus to false if user doc doesn't exist
        }
      });

      return () => {
        unSub();
        statusUnsub(); // Cleanup on unmount
      };
    }
  }, [chatId, user.id, currentUser.id]);

  useEffect(() => {
    const handleOnlineStatus = async () => {
      const userRef = doc(db, "users", currentUser.id);

      await setDoc(userRef, { online: true }, { merge: true });

      // Set offline status on window unload
      window.addEventListener("beforeunload", async () => {
        await setDoc(userRef, { online: false, lastSeen: serverTimestamp() }, { merge: true });
      });

      // Set offline status on disconnect
      window.addEventListener("offline", async () => {
        await setDoc(userRef, { online: false, lastSeen: serverTimestamp() }, { merge: true });
      });
    };

    handleOnlineStatus();

    return () => {
      window.removeEventListener("beforeunload", handleOnlineStatus);
      window.removeEventListener("offline", handleOnlineStatus);
    };
  }, [currentUser.id]);

  const handleEmoji = (e) => {
    setText((prev) => prev + e.emoji);
    setOpen(false);
  };

  const handleImg = (e) => {
    if (e.target.files[0]) {
      setImg({
        file: e.target.files[0],
        url: URL.createObjectURL(e.target.files[0]),
      });
    }
  };

  const handleSend = async () => {
    if (text === "") return;

    let imgUrl = null;

    try {
      if (img.file) {
        imgUrl = await upload(img.file);
      }

      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayUnion({
          senderId: currentUser.id,
          text,
          createdAt: new Date(),
          isRead: false,
          ...(imgUrl && { img: imgUrl }),
        }),
      });

      const userIDs = [currentUser.id, user.id];

      userIDs.forEach(async (id) => {
        const userChatsRef = doc(db, "userchats", id);
        const userChatsSnapshot = await getDoc(userChatsRef);

        if (userChatsSnapshot.exists()) {
          const userChatsData = userChatsSnapshot.data();

          const chatIndex = userChatsData.chats.findIndex(
            (c) => c.chatId === chatId
          );

          userChatsData.chats[chatIndex].lastMessage = text;
          userChatsData.chats[chatIndex].isSeen =
            id === currentUser.id ? true : false;
          userChatsData.chats[chatIndex].updatedAt = Date.now();

          await updateDoc(userChatsRef, {
            chats: userChatsData.chats,
          });
        }
      });
    }catch (err) {
      console.log(err);
    } finally {
      setImg({
        file: null,
        url: "",
      });

      setText("");
    }
  };

  const renderTickMarks = (message) => {
    if (message.senderId === currentUser.id) {
      return (
        <span
          className="tick-marks"
          style={{
            color: message.isRead ? "#34B7F1" : "#A8AABA", // WhatsApp blue for read
            fontSize: "1.2em",
            fontWeight: "bold",
            marginLeft: "5px"
          }}
        >
          {message.isRead ? "✓✓" : "✓"}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="chat">
      <div className="top">
        <div className="user">
          <img src={user?.avatar || "./avatar.png"} alt="" />
          <div className="texts">
            <span>{user?.username}</span>
            <p>{onlineStatus ? "Online" : "Offline"}</p> {/* Display online status */}
          </div>
        </div>
        <div className="icons">
          <img src="./phone.png" alt="" />
          <img src="./video.png" alt="" />
          <img src="./info.png" alt="" />
        </div>
      </div>
      <div className="center">
        {chat?.messages ? (
          chat.messages.map((message) => (
            <div
              className={
                message.senderId === currentUser?.id ? "message own" : "message"
              }
              key={message?.createdAt?.seconds}
            >
              <div className="texts">
                {message.img && <img src={message.img} alt="" />}
                <p>{message.text}</p>
                <span>{format(message.createdAt.toDate())}</span>
                {renderTickMarks(message)}
              </div>
            </div>
          ))
        ) : (
          <p>Loading messages...</p>
        )}
        {img.url && (
          <div className="message own">
            <div className="texts">
              <img src={img.url} alt="" />
            </div>
          </div>
        )}
        <div ref={endRef}></div>
      </div>
      <div className="bottom">
        <div className="icons">
          <label htmlFor="file">
            <img src="./img.png" alt="" />
          </label>
          <input
            type="file"
            id="file"
            style={{ display: "none" }}
            onChange={handleImg}
          />
          <img src="./camera.png" alt="" />
          <img src="./mic.png" alt="" />
        </div>
        <input
          type="text"
          placeholder={
            isCurrentUserBlocked || isReceiverBlocked
              ? "You cannot send a message"
              : "Type a message..."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isCurrentUserBlocked || isReceiverBlocked}
        />
        <div className="emoji">
          <img
            src="./emoji.png"
            alt=""
            onClick={() => setOpen((prev) => !prev)}
          />
          <div className="picker">
            <EmojiPicker open={open} onEmojiClick={handleEmoji} />
          </div>
        </div>
        <button
          className="sendButton"
          onClick={handleSend}
          disabled={isCurrentUserBlocked || isReceiverBlocked}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;