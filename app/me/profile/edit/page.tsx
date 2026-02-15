import ProfileEditClient from "./ProfileEditClient";

type ProfileEditPageProps = {
  searchParams?: {
    required?: string;
  };
};

export default function ProfileEditPage({ searchParams }: ProfileEditPageProps) {
  return <ProfileEditClient requiredParam={searchParams?.required ?? null} />;
}
