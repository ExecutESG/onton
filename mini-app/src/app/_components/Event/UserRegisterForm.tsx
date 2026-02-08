import { trpc } from "@/app/_trpc/client";
import { EventRegisterSchema } from "@/types";
import { List, ListInput } from "konsta/react";
import { useParams } from "next/navigation";
import React, { useRef, useState } from "react";
import { toast } from "sonner";
import CustomButton from "../Button/CustomButton";

const UserRegisterForm = () => {
  const params = useParams<{ hash: string }>();
  const registrationForm = useRef<HTMLFormElement>(null);
  const [isOpen, setOpen] = useState(false);

  const [formErrors, setErrors] = useState<{
    full_name?: string[];
    company?: string[];
    position?: string[];
    linkedin?: string[];
    github?: string[];
    notes?: string[];
  }>();

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

    if (!registrationForm.current) {
      return;
    }
    const formData = new FormData(registrationForm.current);
    const formObject = Object.fromEntries(formData.entries());
    const registrationData = {
      event_uuid: params.hash,
      ...formObject,
    };

    const parsedData = EventRegisterSchema.safeParse(registrationData);

    if (parsedData.error) {
      setErrors(parsedData.error.flatten().fieldErrors);
      return;
    }
    setErrors(undefined);

    registerUser.mutate(parsedData.data);
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
          <ListInput
            outline
            label="Full Name"
            name="full_name"
            error={formErrors?.full_name?.[0]}
            placeholder="John Doe"
          />
          <ListInput
            outline
            label="Company"
            name="company"
            error={formErrors?.company?.[0]}
            placeholder="Example Company"
          />
          <ListInput
            outline
            label="Position"
            name="position"
            error={formErrors?.position?.[0]}
            placeholder="Designer"
          />
          <ListInput
            outline
            label="LinkedIn"
            name="linkedin"
            error={formErrors?.linkedin?.[0]}
            placeholder="https://www.linkedin.com/in/john"
          />
          <ListInput
            outline
            label="Github"
            name="github"
            error={formErrors?.github?.[0]}
            placeholder="john_doe"
          />
          <ListInput
            outline
            info="Optional"
            placeholder="I will be 30min late"
            name="notes"
            error={formErrors?.notes?.[0]}
            label="Additional information"
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
export default UserRegisterForm;
