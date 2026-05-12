"use client";

import { useState, useRef, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { Delete } from "./Delete";
import { deleteUser } from "../lib/db/actions";
import { TbTrash, TbLogout2 } from "react-icons/tb";

export default function Account() {
  const { data: session } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!session?.user) return null;

  const { id, name, image } = session.user as {
    id: string;
    name?: string;
    image?: string;
  };

  async function handleDeleteConfirm() {
    try {
      await deleteUser(Number(id));
      signOut();
    } catch (error) {
      // error handled silently for now
    }
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden border border-muted"
        >
          {image ? (
            <img
              src={image}
              alt={name || "User"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted text-sm flex items-center justify-center">
              {name?.[0]?.toUpperCase() || "U"}
            </div>
          )}
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-card text-sm rounded-md z-50 shadow">
            <button
              onClick={() => {
                signOut();
                setDropdownOpen(false);
              }}
              className="flex items-center gap-2 w-full text-left px-4 py-3 rounded-t-md font-semibold hover:bg-primary/10 transition duration-300 ease-in-out"
             >
              <TbLogout2 className="h-4 w-4" />
              Sign out
            </button>
            <button
              onClick={() => {
                setDeleteModalOpen(true);
                setDropdownOpen(false);
              }}
              className="flex items-center gap-2 w-full text-left px-4 py-3 rounded-b-md border-t border-primary/20 font-semibold text-destructive hover:bg-primary/10 transition duration-300 ease-in-out"
              >
              <TbTrash className="h-4 w-4" />
              Delete account
            </button>
          </div>
        )}
      </div>
      <Delete
        open={deleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        confirmText="Delete Account"
        title="Are you sure you want to delete your account?"
        description="This will permanently delete your account and all of its data. This cannot be undone. Are you sure?"
      />
    </>
  );
}