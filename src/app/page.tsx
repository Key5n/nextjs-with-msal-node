import { getUser } from "@/lib/get-user";

export default async function Home() {
  const user = await getUser();

  return (
    <div>
      {Object.keys(user).map((key) => {
        return (
          <div key={key}>
            {key}: {user[key] || "undefined"}
          </div>
        );
      })}
    </div>
  );
}
