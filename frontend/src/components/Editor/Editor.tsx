"use client";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Color from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import CharacterCount from "@tiptap/extension-character-count";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import Toolbar from "./Toolbar";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
} from "lucide-react";

interface EditorProps {
  docId: string;
  user: { id: string; name: string; email: string; avatar_color?: string };
  onWordCountChange?: (count: number) => void;
}

interface CollabInstances {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
}

export default function Editor({
  docId,
  user,
  onWordCountChange,
}: EditorProps) {
  // Initialize Y.Doc + WebsocketProvider synchronously so they're ready when
  // useEditor runs. The provider is created on first render (client only).
  const instancesRef = useRef<CollabInstances | null>(null);
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

  // Lazily create collab instances once, synchronously, client-side only
  if (!instancesRef.current && typeof window !== "undefined") {
    const token = localStorage.getItem("token") || "";
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(wsUrl, `collab/${docId}`, ydoc, {
      params: { token },
      connect: true,
    });
    provider.awareness.setLocalStateField("user", {
      name: user.name,
      color: user.avatar_color || "#4f46e5",
    });
    instancesRef.current = { ydoc, provider };
  }

  // Wire up status events and clean up on unmount
  useEffect(() => {
    const { provider } = instancesRef.current!;

    const onStatus = ({ status }: { status: string }) =>
      setConnected(status === "connected");
    const onSync = (isSynced: boolean) => setSynced(isSynced);

    provider.on("status", onStatus);
    provider.on("sync", onSync);

    return () => {
      provider.off("status", onStatus);
      provider.off("sync", onSync);
      provider.destroy();
      instancesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: instancesRef.current!.ydoc }),
      CollaborationCursor.configure({
        provider: instancesRef.current!.provider,
        user: { name: user.name, color: user.avatar_color || "#4f46e5" },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Color,
      TextStyle,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Subscript,
      Superscript,
      CharacterCount,
    ],
    editorProps: {
      attributes: {
        class: "tiptap-editor",
        "data-placeholder": "Start typing...",
      },
    },
    onUpdate: ({ editor }) => {
      const words = editor.storage.characterCount.words();
      onWordCountChange?.(words);
    },
  });

  return (
    <div className="flex flex-col w-[816px]">
      {/* Connection status */}
      <div className="flex items-center gap-3 mb-2 px-1">
        <div
          className={`flex items-center gap-1.5 text-xs ${connected ? "text-green-600" : "text-gray-400"}`}
        >
          <div
            className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-300"}`}
          />
          {connected
            ? synced
              ? "All changes saved"
              : "Saving..."
            : "Connecting..."}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-t-lg border border-b-0 border-gray-200">
        <Toolbar editor={editor} />
      </div>

      {/* Bubble menu */}
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="flex items-center gap-0.5 bg-gray-900 text-white rounded-lg px-1 py-1 shadow-lg">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded hover:bg-gray-700 transition ${editor.isActive("bold") ? "bg-gray-700" : ""}`}
            >
              <Bold size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded hover:bg-gray-700 transition ${editor.isActive("italic") ? "bg-gray-700" : ""}`}
            >
              <Italic size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded hover:bg-gray-700 transition ${editor.isActive("underline") ? "bg-gray-700" : ""}`}
            >
              <UnderlineIcon size={14} />
            </button>
            <div className="w-px h-4 bg-gray-600 mx-0.5" />
            <button
              onClick={() => {
                const url = prompt("URL:");
                if (url) editor.chain().focus().setLink({ href: url }).run();
              }}
              className={`p-1.5 rounded hover:bg-gray-700 transition ${editor.isActive("link") ? "bg-gray-700" : ""}`}
            >
              <LinkIcon size={14} />
            </button>
          </div>
        </BubbleMenu>
      )}

      {/* Editor */}
      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
}
