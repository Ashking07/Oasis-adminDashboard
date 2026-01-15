import supabase, { supabaseUrl } from "./supabase";

export async function getCabins() {
  const { data, error } = await supabase.from("cabins").select("*");

  if (error) {
    console.error(error);
    throw new Error("Cabins could not be loaded");
  }

  return data;
}

export async function createEditCabin(newCabin, id) {
  // Example supabase image storage full path: https://uceahnvsaaxotaucckmi.supabase.co/storage/v1/object/public/cabin-images/cabin-001.jpg
  // How did we exactly determined how the full path looks like?
  // 1) We know the base URL from supabaseUrl
  // 2) We know the bucket name from supabase.storage.from("cabin-images")
  // 3) We know the image name from newCabin.image.name
  // So we can combine all 3 to create the full path
  // Note: We also add Math.random() to the image name to avoid name collisions
  // So the final image name looks like: 0.123456789-cabin-001.jpg with the path being:
  // https://uceahnvsaaxotaucckmi.supabase.co/storage/v1/object/public/cabin-images/0.123456789-cabin-001.jpg
  // We also replace "/" in the image name to avoid issues in the path
  // For example, if the image name is "my/image.jpg", we change it to "myimage.jpg", this avoids creations of sub-folders in storage
  // Now, supabase accesses the uploaded image directly via the full path we created, which is stored in the database bucket.
  // Basically, when we fetch cabins, we get the image path from the database bucket and can use it to display the image directly from bucket.

  const hasImagePath = newCabin.image?.startsWith?.(supabaseUrl);
  const imageName = `${Math.random()}-${newCabin.image.name}`.replaceAll(
    "/",
    ""
  );
  const imagePath = hasImagePath
    ? newCabin.image
    : `${supabaseUrl}/storage/v1/object/public/cabin-images/${imageName}`;

  // In above step, we are saying that if the newCabin.image already has the full path (meaning the image is already uploaded (we are truly editing a cabin and not creating a new one)), we use it directly.
  // Otherwise, we create the full path using the supabaseUrl, bucket name, and imageName.

  // 1. Create/edit cabin
  let query = supabase.from("cabins");

  // A) CREATE
  if (!id) query = query.insert([{ ...newCabin, image: imagePath }]);

  // B) EDIT
  if (id) query = query.update({ ...newCabin, image: imagePath }).eq("id", id);

  const { data, error } = await query.select().single();

  if (error) {
    console.error(error);
    throw new Error("Cabin could not be created");
  }

  // 2. Upload image
  if (hasImagePath) return data;

  const { error: storageError } = await supabase.storage
    .from("cabin-images")
    .upload(imageName, newCabin.image); // Here we are uploading the Actual image to storage bucket

  // 3. Delete the cabin IF there was an error uplaoding image
  if (storageError) {
    await supabase.from("cabins").delete().eq("id", data.id);
    console.error(storageError);
    throw new Error(
      "Cabin image could not be uploaded and the cabin was not created"
    );
  }

  return data;
}

export async function deleteCabin(id) {
  const { data, error } = await supabase.from("cabins").delete().eq("id", id);

  if (error) {
    console.error(error);
    throw new Error("Cabin could not be deleted");
  }

  return data;
}
