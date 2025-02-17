import { UserWhereUniqueInput } from "../user/UserWhereUniqueInput";

export type MessageCreateInput = {
  content?: string | null;
  sentAt?: Date | null;
  user?: UserWhereUniqueInput | null;
};
