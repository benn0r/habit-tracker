import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import Vacations from "./Vacations";

export default async function VacationsPage() {
  if (!(await getUserId())) redirect("/");
  return <Vacations />;
}
