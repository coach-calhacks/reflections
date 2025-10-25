import { Button } from "@/components/ui/button";

const App = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Button className="w-48 rounded-full">Get Started</Button>
      <Button className="w-48 rounded-full">Login as Caden</Button>
    </div>
  );
};

export default App;
