import { User } from "../user/User";

export type Message = {
  content: string | null;
  createdAt: Date;
  id: string;
  sentAt: Date | null;
  updatedAt: Date;
  user?: User | null;
};
