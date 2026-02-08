"use client";
import { trpc } from "@/app/_trpc/client";
import { CustomEventRegisterSchema } from "@/types";
import { List, ListInput } from "konsta/react";
import { useParams } from "next/navigation";
import React, { useRef, useState } from "react";
import { toast } from "sonner";
import CustomButton from "../Button/CustomButton";

const UserCustomRegisterForm = () => {
  const params = useParams<{ hash: string }>();
  const registrationForm = useRef<HTMLFormElement>(null);
  const [isOpen, setOpen] = useState(false);

  // Store errors from Zod validation
  const [formErrors, setFormErrors] = useState<{
    full_name?: string[];
    company?: string[];
    role?: string[];
    linkedin?: string[];
    github?: string[];
    email?: string[];
    career?: string[];
    developer_type?: string[];
    main_goal?: string[];
  }>({});

  // This state is used to conditionally show/hide the "If you're a developer..." field
  const [attendeeType, setAttendeeType] = useState<string>("");

  // TRPC mutation
  const trpcUtils = trpc.useUtils();
  const registerUser = trpc.registrant.eventRegister.useMutation({
    onError: (error) => {
      toast.error(error.data?.code + ": " + error.message);
    },
    onSuccess() {
      trpcUtils.events.getEvent.refetch();
      toast.success("You have successfully registered!");
      setOpen(false);
    },
  });

  const handleSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (!registrationForm.current) return;

    const formData = new FormData(registrationForm.current);
    const formObject = Object.fromEntries(formData.entries());

    const registrationData = {
      event_uuid: params.hash,
      ...formObject,
    };

    const parsed = CustomEventRegisterSchema.safeParse(registrationData);
    if (!parsed.success) {
      setFormErrors(parsed.error.flatten().fieldErrors);
      return;
    }

    setFormErrors({});
    registerUser.mutate(parsed.data);
  };

  return (
    <>
      {/*{!isOpen && (*/}
      {/*  <MainButton*/}
      {/*    onClick={() => {*/}
      {/*      setOpen(true);*/}
      {/*    }}*/}
      {/*    text="Request to Join"*/}
      {/*  />*/}
      {/*)}*/}
      {/*<ReusableSheet*/}
      {/*  opened={isOpen}*/}
      {/*  title="Registration Form"*/}
      {/*  onClose={() => {*/}
      {/*    setOpen(false);*/}
      {/*  }}*/}
      {/*  className={"overflow-y-auto"}*/}
      {/*>*/}
      <form
        ref={registrationForm}
        onSubmit={handleSubmit}
      >
        <List
          strongIos
          className="!my-6"
        >
          {/* 1. Full Name - required */}
          <ListInput
            outline
            label="Full Name"
            name="full_name"
            error={formErrors?.full_name?.[0]}
            placeholder="John Doe"
          />

          {/* 2. What company/organization do you represent? - required */}
          <ListInput
            outline
            label="Company/Organization"
            name="company"
            error={formErrors?.company?.[0]}
            placeholder="Your Company"
          />

          {/* 4. What is your role there? - required */}
          <ListInput
            outline
            label="Your Role"
            name="role"
            error={formErrors?.role?.[0]}
            placeholder="Developer, Designer, etc."
          />

          {/* 5. LinkedIn - not required */}
          <ListInput
            outline
            label="LinkedIn"
            name="linkedin"
            error={formErrors?.linkedin?.[0]}
            placeholder="https://linkedin.com/in/your-profile"
          />

          {/* 5. GitHub - not required */}
          <ListInput
            outline
            label="GitHub"
            name="github"
            error={formErrors?.github?.[0]}
            placeholder="your-username"
          />

          {/* 7. Email - required */}
          <ListInput
            outline
            label="Email"
            name="email"
            error={formErrors?.email?.[0]}
            type="email"
            placeholder="you@example.com"
          />

          {/* 8. How do you describe yourself? (selectbox) - required */}
          <ListInput
            outline
            label="How do you describe yourself?"
            type="select"
            name="career"
            error={formErrors?.career?.[0]}
            onChange={(e) => setAttendeeType(e.target.value)}
          >
            <option value="">Select an option</option>
            <option value="Developer">Developer</option>
            <option value="Content creator">Content creator</option>
            <option value="Founder">Founder</option>
            <option value="Enthusiast">Enthusiast</option>
            <option value="Airdrop hunter">Airdrop hunter</option>
            <option value="Business Developer">Business Developer</option>
            <option value="KOL">KOL</option>
          </ListInput>

          {/* 9. If you're a developer, are you solo or have a team? (selectbox) */}
          {attendeeType === "Developer" && (
            <ListInput
              outline
              label="If you're a developer, are you solo or have a team?"
              type="select"
              name="developer_type"
              error={formErrors?.developer_type?.[0]}
            >
              <option value="">Select an option</option>
              <option value="solo">Solo</option>
              <option value="team">Team</option>
            </ListInput>
          )}

          {/* 10. Your event request/goal for attending the event? - required */}
          <ListInput
            outline
            label="Your Event Request/Goal"
            name="main_goal"
            error={formErrors?.main_goal?.[0]}
            placeholder="e.g., Networking, Funding, Learning, etc."
          />
        </List>

        <div className="pt-0 space-y-3 p-4">
          <CustomButton
            variant="primary"
            isLoading={registerUser.isLoading}
            onClick={() => {
              registrationForm.current?.requestSubmit();
            }}
          >
            Submit Request
          </CustomButton>
          {/*<CustomButton*/}
          {/*  variant="outline"*/}
          {/*  isLoading={registerUser.isLoading}*/}
          {/*  onClick={() => {*/}
          {/*    setOpen(false);*/}
          {/*  }}*/}
          {/*>*/}
          {/*  Cancel*/}
          {/*</CustomButton>*/}
        </div>
      </form>
      {/*</ReusableSheet>*/}
    </>
  );
};

export default UserCustomRegisterForm;
