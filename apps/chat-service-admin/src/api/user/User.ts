import { Message } from "../message/Message";
import { JsonValue } from "type-fest";

export type User = {
  createdAt: Date;
  email: string | null;
  firstName: string | null;
  id: string;
  lastName: string | null;
  messages?: Array<Message>;
  roles: JsonValue;
  updatedAt: Date;
  username: string;
};
