import { useQuery } from "@tanstack/react-query";
import { getCabins } from "../../services/apiCabins";

export function useCabins() {
  const {
    isLoading,
    data: cabins,
    error,
  } = useQuery({
    queryKey: ["cabins"],
    queryFn: getCabins,
  });

  //Above, we are calling the useQuery hook from React Query to fetch cabin data using the getCabins function.
  // Then we store the returned data from that function in a variable called "cabins" in the cache of React Query.
  // This allows us to easily access and manage the cabin data throughout our application.
  // React Query also provides useful properties like isLoading and error to handle loading states and errors.
  // You can see what all state/properties React Query provides in their by storing everything returned from useQuery in a variable (e.g const queryInfo = useQuery(...)) and logging it to the console.

  return { isLoading, error, cabins };
}
